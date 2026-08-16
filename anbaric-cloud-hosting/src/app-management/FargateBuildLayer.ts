import {readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {CodeBuildClient, BatchGetBuildsCommand, StartBuildCommand} from "@aws-sdk/client-codebuild";
import {ECSClient, CreateServiceCommand, DeleteServiceCommand, DescribeServicesCommand,
    RegisterTaskDefinitionCommand, UpdateServiceCommand} from "@aws-sdk/client-ecs";
import {S3Client, PutObjectCommand} from "@aws-sdk/client-s3";
import {ServiceDiscoveryClient, CreateServiceCommand as CreateDiscoveryServiceCommand,
    ListServicesCommand} from "@aws-sdk/client-servicediscovery";
import {BaseBuildLayer, Deployment, Probe} from "./BaseBuildLayer";
import {dockerfileFor} from "./DockerBuildLayer";

type FargateBuildLayerOptions = {
    awsRegion : string,
    cluster : string,
    subnets : Array<string>,
    appSecurityGroup : string,
    namespaceId : string,
    namespaceName : string,
    appsRepositoryUrl : string,
    buildBucket : string,
    buildProject : string,
    baseImage : string,
    appExecutionRoleArn : string,
    appsLogGroup : string,
    platformUrl : string,
};

type AwsClients = {
    s3 : { send(command : any) : Promise<any> },
    codeBuild : { send(command : any) : Promise<any> },
    ecs : { send(command : any) : Promise<any> },
    serviceDiscovery : { send(command : any) : Promise<any> },
};

const defaultClients = (region : string) : AwsClients => ({
    s3: new S3Client({ region }),
    codeBuild: new CodeBuildClient({ region }),
    ecs: new ECSClient({ region }),
    serviceDiscovery: new ServiceDiscoveryClient({ region }),
});

const BUILD_TIMEOUT_MS = 900_000;
const FARGATE_LIVENESS_TIMEOUT_MS = 420_000;

class FargateBuildLayer extends BaseBuildLayer {

    private aws : AwsClients;

    constructor(appsDir : string, private options : FargateBuildLayerOptions,
                consumerPortBase? : number,
                aws? : AwsClients, probe? : Probe,
                private buildPollIntervalMs : number = 5000) {
        super(appsDir, consumerPortBase, probe, FARGATE_LIVENESS_TIMEOUT_MS);
        this.aws = aws ?? defaultClients(options.awsRegion);
    }

    protected appHostFor(appName : string) : string {
        return `${appName}.${this.options.namespaceName}`;
    }

    protected async start(deployment : Deployment, appDir : string, entryPoint : string) : Promise<void> {
        const imageUri = `${this.options.appsRepositoryUrl}:${deployment.appName}`;

        await writeFile(join(appDir, "Dockerfile"), dockerfileFor(this.options.baseImage, entryPoint));
        await this.uploadBundle(deployment, appDir);
        await this.bakeImage(deployment, imageUri);

        if (!this.isCurrent(deployment)) return;
        const taskDefinition = await this.registerTaskDefinition(deployment, imageUri);
        const registryArn = await this.discoveryServiceFor(deployment.appName);
        await this.upsertService(deployment, taskDefinition, registryArn);
    }

    protected async stop(deployment : Deployment) : Promise<void> {
        if (this.deployments.get(deployment.appName) !== deployment) return;

        await this.aws.ecs.send(new DeleteServiceCommand({
            cluster: this.options.cluster,
            service: this.serviceNameFor(deployment.appName),
            force: true,
        })).catch(() => {});
    }

    private async uploadBundle(deployment : Deployment, appDir : string) : Promise<void> {
        const bundlePath = join(this.appsDir, `${deployment.appName}-image.tar.gz`);
        await this.run(deployment, "tar", ["-czf", bundlePath, "-C", appDir, "."]);

        this.log(deployment, "uploading build context");
        await this.aws.s3.send(new PutObjectCommand({
            Bucket: this.options.buildBucket,
            Key: this.buildKeyFor(deployment.appName),
            Body: await readFile(bundlePath),
        }));
    }

    private async bakeImage(deployment : Deployment, imageUri : string) : Promise<void> {
        this.log(deployment, `baking image ${imageUri} with CodeBuild`);
        const started = await this.aws.codeBuild.send(new StartBuildCommand({
            projectName: this.options.buildProject,
            environmentVariablesOverride: [
                { name: "TARBALL_S3_URI", value: `s3://${this.options.buildBucket}/${this.buildKeyFor(deployment.appName)}` },
                { name: "IMAGE_URI", value: imageUri },
                { name: "REPOSITORY_HOST", value: this.options.appsRepositoryUrl.split("/")[0] },
            ],
        }));

        const deadline = Date.now() + BUILD_TIMEOUT_MS;
        let lastPhase = "";
        while (Date.now() < deadline) {
            const {builds} = await this.aws.codeBuild.send(new BatchGetBuildsCommand({ ids: [started.build.id] }));
            const build = builds[0];

            if (build.currentPhase && build.currentPhase !== lastPhase) {
                lastPhase = build.currentPhase;
                this.log(deployment, `build ${lastPhase.toLowerCase()}`);
            }
            if (build.buildStatus === "SUCCEEDED") return;
            if (build.buildStatus !== "IN_PROGRESS") {
                throw new Error(`CodeBuild build finished with status ${build.buildStatus}`);
            }
            await new Promise(resolve => setTimeout(resolve, this.buildPollIntervalMs));
        }

        throw new Error(`CodeBuild build did not finish within ${BUILD_TIMEOUT_MS / 1000}s`);
    }

    private async registerTaskDefinition(deployment : Deployment, imageUri : string) : Promise<string> {
        const registered = await this.aws.ecs.send(new RegisterTaskDefinitionCommand({
            family: this.serviceNameFor(deployment.appName),
            requiresCompatibilities: ["FARGATE"],
            networkMode: "awsvpc",
            cpu: "256",
            memory: "512",
            executionRoleArn: this.options.appExecutionRoleArn,
            runtimePlatform: { operatingSystemFamily: "LINUX", cpuArchitecture: "X86_64" },
            containerDefinitions: [{
                name: deployment.appName,
                image: imageUri,
                essential: true,
                portMappings: [
                    { containerPort: deployment.appPort, protocol: "tcp" },
                    { containerPort: deployment.consumerPort, protocol: "tcp" },
                ],
                environment: [
                    { name: "PORT", value: String(deployment.appPort) },
                    { name: "ANBARIC_CLOUD_URL", value: this.options.platformUrl },
                    { name: "ANBARIC_JOB_PERSISTENCE_TYPE", value: "cloud" },
                    { name: "ANBARIC_QUEUE_TYPE", value: "cloud" },
                    { name: "ANBARIC_JSON_STORE_TYPE", value: "cloud" },
                    { name: "ANBARIC_SECRET_STORE_TYPE", value: "cloud" },
                    { name: "ANBARIC_CONSUMER_PORT", value: String(deployment.consumerPort) },
                    { name: "ANBARIC_CONSUMER_URL", value: `http://${deployment.appHost}:${deployment.consumerPort}` },
                ],
                logConfiguration: {
                    logDriver: "awslogs",
                    options: {
                        "awslogs-group": this.options.appsLogGroup,
                        "awslogs-region": this.options.awsRegion,
                        "awslogs-stream-prefix": deployment.appName,
                    },
                },
            }],
        }));

        return registered.taskDefinition.taskDefinitionArn;
    }

    private async discoveryServiceFor(appName : string) : Promise<string> {
        const {Services} = await this.aws.serviceDiscovery.send(new ListServicesCommand({
            Filters: [{ Name: "NAMESPACE_ID", Values: [this.options.namespaceId], Condition: "EQ" }],
        }));
        const existing = (Services ?? []).find((service : { Name : string }) => service.Name === appName);
        if (existing) return existing.Arn;

        const created = await this.aws.serviceDiscovery.send(new CreateDiscoveryServiceCommand({
            Name: appName,
            NamespaceId: this.options.namespaceId,
            DnsConfig: { DnsRecords: [{ Type: "A", TTL: 10 }], RoutingPolicy: "MULTIVALUE" },
        }));
        return created.Service.Arn;
    }

    private async upsertService(deployment : Deployment, taskDefinition : string, registryArn : string) : Promise<void> {
        const serviceName = this.serviceNameFor(deployment.appName);
        const {services} = await this.aws.ecs.send(new DescribeServicesCommand({
            cluster: this.options.cluster,
            services: [serviceName],
        }));
        const active = (services ?? []).find((service : { status : string }) => service.status === "ACTIVE");

        if (active) {
            this.log(deployment, `rolling service ${serviceName}`);
            await this.aws.ecs.send(new UpdateServiceCommand({
                cluster: this.options.cluster,
                service: serviceName,
                taskDefinition,
                desiredCount: 1,
                forceNewDeployment: true,
            }));
            return;
        }

        this.log(deployment, `creating service ${serviceName}`);
        await this.aws.ecs.send(new CreateServiceCommand({
            cluster: this.options.cluster,
            serviceName,
            taskDefinition,
            desiredCount: 1,
            launchType: "FARGATE",
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: this.options.subnets,
                    securityGroups: [this.options.appSecurityGroup],
                    assignPublicIp: "ENABLED",
                },
            },
            serviceRegistries: [{ registryArn }],
        }));
    }

    private serviceNameFor(appName : string) : string {
        return `anbaric-app-${appName}`;
    }

    private buildKeyFor(appName : string) : string {
        return `builds/${appName}.tar.gz`;
    }

}

export { FargateBuildLayer };
export type { AwsClients, FargateBuildLayerOptions };
