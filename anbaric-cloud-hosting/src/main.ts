import {SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {SecretStore} from "anbaric-tsapi";
import {InMemorySecretStore} from "anbaric-data-store";
import {Pool} from "pg";
import {loadAuthenticator} from "./auth/AuthenticatorLoader";
import {CliAuthorizer} from "./auth/CliAuthorizer";
import {TokenAuthenticator} from "./auth/TokenAuthenticator";
import {PostgresCliKeyStore} from "./data-store/PostgresCliKeyStore";
import {ensureSchema} from "./data-store/Schema";
import {SecretsManagerSecretStore} from "./data-store/SecretsManagerSecretStore";
import {PostgresJobPersistence} from "./data-store/PostgresJobPersistence";
import {PostgresJsonStore} from "./data-store/PostgresJsonStore";
import {PostgresQueue} from "./queuing/PostgresQueue";
import {DockerBuildLayer} from "./app-management/DockerBuildLayer";
import {FargateBuildLayer} from "./app-management/FargateBuildLayer";
import {ConsumerRegistry} from "./queuing/ConsumerRegistry";
import {Dispatcher} from "./queuing/Dispatcher";
import {HostingServer} from "./hosting/HostingServer";

const pool = new Pool({ connectionString: process.env.ANBARIC_DATABASE_URL });
await ensureSchema(pool);

const queue = new PostgresQueue(pool);
const registry = new ConsumerRegistry();

const hostingPort = Number(process.env.ANBARIC_HOSTING_PORT ?? 8787);
const internalPort = Number(process.env.ANBARIC_INTERNAL_PORT ?? 8788);
const appsDir = process.env.ANBARIC_APPS_DIR ?? "/tmp/anbaric-apps";

const buildLayer = process.env.ANBARIC_BUILD_LAYER === "docker"
    ? new DockerBuildLayer(appsDir, {
        baseImage: process.env.ANBARIC_APP_BASE_IMAGE ?? "anbaric-v2-platform:local",
        network: process.env.ANBARIC_DOCKER_NETWORK ?? "anbaric-v2-local",
        platformUrl: process.env.ANBARIC_PLATFORM_INTERNAL_URL ?? `http://localhost:${internalPort}`,
    })
    : process.env.ANBARIC_BUILD_LAYER === "fargate"
    ? new FargateBuildLayer(appsDir, {
        awsRegion: process.env.AWS_REGION!,
        cluster: process.env.ANBARIC_AWS_CLUSTER!,
        subnets: (process.env.ANBARIC_AWS_SUBNETS ?? "").split(","),
        appSecurityGroup: process.env.ANBARIC_AWS_APP_SECURITY_GROUP!,
        namespaceId: process.env.ANBARIC_AWS_NAMESPACE_ID!,
        namespaceName: process.env.ANBARIC_AWS_NAMESPACE_NAME!,
        appsRepositoryUrl: process.env.ANBARIC_AWS_APPS_REPOSITORY!,
        buildBucket: process.env.ANBARIC_AWS_BUILD_BUCKET!,
        buildProject: process.env.ANBARIC_AWS_BUILD_PROJECT!,
        baseImage: process.env.ANBARIC_AWS_BASE_IMAGE!,
        appExecutionRoleArn: process.env.ANBARIC_AWS_APP_EXECUTION_ROLE!,
        appsLogGroup: process.env.ANBARIC_AWS_APPS_LOG_GROUP!,
        platformUrl: process.env.ANBARIC_PLATFORM_INTERNAL_URL!,
    })
    : undefined;

const secretStore : SecretStore = process.env.AWS_REGION
    ? new SecretsManagerSecretStore(new SecretsManagerClient({}))
    : new InMemorySecretStore();

const authenticator = await loadAuthenticator(process.env.ANBARIC_AUTHENTICATOR);
const cliKeyStore = new PostgresCliKeyStore(pool);
const cliAuthorizer = new CliAuthorizer(cliKeyStore);
const tokenAuthenticator = new TokenAuthenticator(cliKeyStore);

const server = new HostingServer(new PostgresJobPersistence(pool), queue, registry, buildLayer,
    (collection) => new PostgresJsonStore(pool, collection), secretStore, authenticator, cliAuthorizer,
    tokenAuthenticator, process.env.ANBARIC_TENANT);
const port = await server.listen(hostingPort);
const internal = await server.listenInternal(internalPort);

const dispatcher = new Dispatcher(queue, registry, Number(process.env.ANBARIC_DISPATCH_INTERVAL_MS ?? 1000));
dispatcher.start();

console.log(`anbaric-cloud-hosting listening on port ${port}, internal entry point on ${internal}`);
