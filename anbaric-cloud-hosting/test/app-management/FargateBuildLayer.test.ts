import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {AwsClients, FargateBuildLayer} from "../../src/app-management/FargateBuildLayer";

const APP_PORT = 4000;
const CONSUMER_PORT_BASE = 8950;

const FARGATE_OPTIONS = {
    awsRegion: "eu-west-3",
    cluster: "anbaric-test",
    subnets: ["subnet-1", "subnet-2"],
    appSecurityGroup: "sg-apps",
    namespaceId: "ns-1",
    namespaceName: "anbaric-test.local",
    appsRepositoryUrl: "123.dkr.ecr.eu-west-3.amazonaws.com/anbaric-test-apps",
    buildBucket: "anbaric-test-builds",
    buildProject: "anbaric-test-app-build",
    baseImage: "123.dkr.ecr.eu-west-3.amazonaws.com/anbaric-test-platform:latest",
    appExecutionRoleArn: "arn:role/app-execution",
    appsLogGroup: "/anbaric/test/apps",
    appsLogGroupArn: "arn:aws:logs:eu-west-3:123:log-group:/anbaric/test/apps",
    platformUrl: "http://platform.anbaric-test.local:8788",
};

const writeFixtureApp = async (dir : string) : Promise<void> => {
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "package.json"), JSON.stringify({
        name: "fixture-app",
        type: "module",
        main: "src/main.ts",
        dependencies: { "anbaric-tsapi": "*" },
    }));
    await writeFile(join(dir, "src", "main.ts"), "export {};");
};

const packFixture = async (dir : string) : Promise<Buffer> => {
    const tarballPath = join(dir, "..", "fixture.tar.gz");
    await new Promise<void>((resolve, reject) => {
        const tar = spawn("tar", ["-czf", tarballPath, "-C", dir, "."]);
        tar.on("exit", code => code === 0 ? resolve() : reject(new Error(`tar exited with ${code}`)));
        tar.on("error", reject);
    });
    return readFile(tarballPath);
};

describe("FargateBuildLayer", () => {

    let workDir : string;
    let buildLayer : FargateBuildLayer;
    let sent : Record<string, Array<any>>;
    let buildStatuses : Array<string>;
    let existingEcsService : boolean;
    let existingDiscoveryService : boolean;
    let liveTailMessages : Array<string>;

    const record = (client : string, command : any) => {
        (sent[client] ??= []).push(command);
    };

    const clients = () : AwsClients => ({
        s3: { send: async (command) => { record("s3", command); return {}; } },
        codeBuild: {
            send: async (command) => {
                record("codeBuild", command);
                if (command.constructor.name === "StartBuildCommand") return { build: { id: "build-1" } };
                return { builds: [{ buildStatus: buildStatuses.shift() ?? "SUCCEEDED", currentPhase: "BUILD" }] };
            },
        },
        ecs: {
            send: async (command) => {
                record("ecs", command);
                if (command.constructor.name === "RegisterTaskDefinitionCommand") {
                    return { taskDefinition: { taskDefinitionArn: "arn:task-def/1" } };
                }
                if (command.constructor.name === "DescribeServicesCommand") {
                    return { services: existingEcsService ? [{ status: "ACTIVE" }] : [] };
                }
                return {};
            },
        },
        serviceDiscovery: {
            send: async (command) => {
                record("serviceDiscovery", command);
                if (command.constructor.name === "ListServicesCommand") {
                    return { Services: existingDiscoveryService ? [{ Name: "crm", Arn: "arn:discovery/existing" }] : [] };
                }
                return { Service: { Arn: "arn:discovery/created" } };
            },
        },
        cloudWatchLogs: {
            send: async (command) => {
                record("cloudWatchLogs", command);
                return {
                    responseStream: (async function* () {
                        yield { sessionUpdate: { sessionResults: liveTailMessages.map(message => ({ message })) } };
                    })(),
                };
            },
        },
    });

    beforeEach(async () => {
        workDir = await mkdtemp(join(tmpdir(), "anbaric-fargate-"));
        await mkdir(join(workDir, "apps"), { recursive: true });
        sent = {};
        buildStatuses = [];
        existingEcsService = false;
        existingDiscoveryService = false;
        liveTailMessages = [];
        buildLayer = new FargateBuildLayer(
            join(workDir, "apps"),
            FARGATE_OPTIONS,
            CONSUMER_PORT_BASE,
            clients(),
            async () => true,
            1,
        );
    });

    afterEach(async () => {
        await rm(workDir, { recursive: true, force: true });
    });

    const deployFixture = async () => {
        const fixtureDir = join(workDir, "fixture");
        await writeFixtureApp(fixtureDir);
        buildLayer.deploy("crm", APP_PORT, await packFixture(fixtureDir));
        await vi.waitFor(() => {
            const status = buildLayer.status("crm");
            expect(["running", "failed"]).toContain(status?.status);
        });
        return buildLayer.status("crm")!;
    };

    it("names app hosts through the cloud map namespace", async () => {
        const status = await deployFixture();

        expect(status.appHost).toBe("crm.anbaric-test.local");
    });

    it("uploads the build context and bakes the image with codebuild", async () => {
        await deployFixture();

        const upload = sent.s3[0].input;
        expect(upload.Bucket).toBe("anbaric-test-builds");
        expect(upload.Key).toBe("builds/crm.tar.gz");
        expect(upload.Body.length).toBeGreaterThan(0);

        const build = sent.codeBuild[0].input;
        expect(build.projectName).toBe("anbaric-test-app-build");
        expect(build.environmentVariablesOverride).toEqual([
            { name: "TARBALL_S3_URI", value: "s3://anbaric-test-builds/builds/crm.tar.gz" },
            { name: "IMAGE_URI", value: "123.dkr.ecr.eu-west-3.amazonaws.com/anbaric-test-apps:crm" },
            { name: "REPOSITORY_HOST", value: "123.dkr.ecr.eu-west-3.amazonaws.com" },
        ]);
    });

    it("registers a task definition wired to the platform", async () => {
        await deployFixture();

        const registered = sent.ecs.find(command => command.constructor.name === "RegisterTaskDefinitionCommand").input;
        expect(registered.family).toBe("anbaric-app-crm");
        expect(registered.executionRoleArn).toBe("arn:role/app-execution");
        const container = registered.containerDefinitions[0];
        expect(container.image).toBe("123.dkr.ecr.eu-west-3.amazonaws.com/anbaric-test-apps:crm");
        expect(container.environment).toContainEqual({ name: "ANBARIC_CLOUD_URL", value: "http://platform.anbaric-test.local:8788" });
        expect(container.environment).toContainEqual({ name: "PORT", value: String(APP_PORT) });
        expect(container.environment).toContainEqual({ name: "ANBARIC_CONSUMER_URL", value: `http://crm.anbaric-test.local:${CONSUMER_PORT_BASE}` });
    });

    it("creates the app service with cloud map discovery on first deploy", async () => {
        await deployFixture();

        const discovery = sent.serviceDiscovery.find(command => command.constructor.name === "CreateServiceCommand").input;
        expect(discovery.Name).toBe("crm");
        expect(discovery.NamespaceId).toBe("ns-1");

        const created = sent.ecs.find(command => command.constructor.name === "CreateServiceCommand").input;
        expect(created.cluster).toBe("anbaric-test");
        expect(created.serviceName).toBe("anbaric-app-crm");
        expect(created.taskDefinition).toBe("arn:task-def/1");
        expect(created.serviceRegistries).toEqual([{ registryArn: "arn:discovery/created" }]);
        expect(created.networkConfiguration.awsvpcConfiguration.securityGroups).toEqual(["sg-apps"]);
    });

    it("rolls the existing service instead of recreating it", async () => {
        existingEcsService = true;
        existingDiscoveryService = true;

        await deployFixture();

        const updated = sent.ecs.find(command => command.constructor.name === "UpdateServiceCommand").input;
        expect(updated.service).toBe("anbaric-app-crm");
        expect(updated.forceNewDeployment).toBe(true);
        expect(sent.ecs.some(command => command.constructor.name === "CreateServiceCommand")).toBe(false);
        expect(sent.serviceDiscovery.some(command => command.constructor.name === "CreateServiceCommand")).toBe(false);
    });

    it("marks the deployment failed when the build fails", async () => {
        buildStatuses = ["IN_PROGRESS", "FAILED"];

        const status = await deployFixture();

        expect(status.status).toBe("failed");
        expect(status.log.join("\n")).toContain("CodeBuild build finished with status FAILED");
        expect(sent.ecs?.some(command => command.constructor.name === "CreateServiceCommand") ?? false).toBe(false);
    });

    it("becomes running once the app answers its probe", async () => {
        const status = await deployFixture();

        expect(status.status).toBe("running");
        expect(status.log.join("\n")).toContain("app is live (admin port 8791)");
    });

    it("streams live-tail messages as runtime log lines", async () => {
        liveTailMessages = ["hello from the app", "processing job 1"];
        await deployFixture();

        const lines : Array<string> = [];
        for await (const line of buildLayer.logs("crm", new AbortController().signal)) lines.push(line);

        expect(lines).toEqual(["hello from the app", "processing job 1"]);
    });

    it("rehydrates its registry from the running ECS services after a restart", async () => {
        const appTaskDefinition = {
            containerDefinitions: [{
                environment: [
                    { name: "PORT", value: "4000" },
                    { name: "ANBARIC_ADMIN_PORT", value: "8791" },
                    { name: "ANBARIC_CONSUMER_PORT", value: "8801" },
                ],
            }],
        };
        const ecs = {
            send: async (command : any) => {
                switch (command.constructor.name) {
                    case "ListServicesCommand":
                        return { serviceArns: [
                            "arn:aws:ecs:eu-west-3:1:service/anbaric-test/anbaric-app-crm",
                            "arn:aws:ecs:eu-west-3:1:service/anbaric-test/anbaric-staging-platform",
                        ] };
                    case "DescribeServicesCommand":
                        return { services: [{ serviceName: "anbaric-app-crm", status: "ACTIVE", runningCount: 1, taskDefinition: "arn:task-def/crm:3" }] };
                    case "DescribeTaskDefinitionCommand":
                        return { taskDefinition: appTaskDefinition };
                    default:
                        return {};
                }
            },
        };
        const restarted = new FargateBuildLayer(
            join(workDir, "apps"), FARGATE_OPTIONS, CONSUMER_PORT_BASE,
            { ...clients(), ecs }, async () => true, 1,
        );

        expect(restarted.list()).toEqual([]);
        await restarted.ensureHydrated();

        expect(restarted.list()).toEqual([
            { appName: "crm", status: "running", appPort: 4000, appHost: "crm.anbaric-test.local" },
        ]);
    });

    it("only describes the app services, not the platform, and rehydrates once", async () => {
        let listCalls = 0;
        const ecs = {
            send: async (command : any) => {
                switch (command.constructor.name) {
                    case "ListServicesCommand":
                        listCalls++;
                        return { serviceArns: ["arn:aws:ecs:eu-west-3:1:service/anbaric-test/anbaric-staging-platform"] };
                    default:
                        return {};
                }
            },
        };
        const restarted = new FargateBuildLayer(
            join(workDir, "apps"), FARGATE_OPTIONS, CONSUMER_PORT_BASE,
            { ...clients(), ecs }, async () => true, 1,
        );

        await restarted.ensureHydrated();
        await restarted.ensureHydrated();

        expect(restarted.list()).toEqual([]);
        expect(listCalls).toBe(1);
    });

});
