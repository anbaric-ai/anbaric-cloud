import {SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {SecretStore} from "anbaric-tsapi";
import {InMemorySecretStore} from "anbaric-data-store";
import {Pool} from "pg";
import {loadAuthenticator} from "./auth/AuthenticatorLoader";
import {loadNotifier} from "./notifications/NotifierLoader";
import {CliAuthorizer} from "./auth/CliAuthorizer";
import {HttpCliKeyStore} from "./auth/HttpCliKeyStore";
import {TokenAuthenticator} from "./auth/TokenAuthenticator";
import {PostgresAuditRecordStore} from "./data-store/PostgresAuditRecordStore";
import {PostgresCliKeyStore} from "./data-store/PostgresCliKeyStore";
import {ensureSchema} from "./data-store/Schema";
import {SecretsManagerSecretStore} from "./data-store/SecretsManagerSecretStore";
import {PostgresJobRunSchedulePersistence} from "./data-store/PostgresJobRunSchedulePersistence";
import {PostgresJobPersistence} from "./data-store/PostgresJobPersistence";
import {PostgresJsonStore} from "./data-store/PostgresJsonStore";
import {PostgresQueue} from "./queuing/PostgresQueue";
import {DockerBuildLayer} from "./app-management/DockerBuildLayer";
import {FargateBuildLayer} from "./app-management/FargateBuildLayer";
import {DocGenerator} from "./docs/DocGenerator";
import {GatewayDocModel} from "./docs/GatewayDocModel";
import {PostgresAppDocsStore} from "./data-store/PostgresAppDocsStore";
import {PostgresEntitlementStore} from "./data-store/PostgresEntitlementStore";
import {PostgresUserDirectory} from "./data-store/PostgresUserDirectory";
import {HttpMembershipService} from "./auth/HttpMembershipService";
import {PostgresPromptManager} from "./data-store/PostgresPromptManager";
import {ConsumerRegistry} from "./queuing/ConsumerRegistry";
import {Dispatcher} from "./queuing/Dispatcher";
import {HostingServer} from "./hosting/HostingServer";
import {PluginLoader} from "./plugins/PluginLoader";

const pool = new Pool({ connectionString: process.env.ANBARIC_DATABASE_URL });
await ensureSchema(pool);

const queue = new PostgresQueue(pool);
const registry = new ConsumerRegistry();

const hostingPort = Number(process.env.ANBARIC_HOSTING_PORT ?? 8787);
const internalPort = Number(process.env.ANBARIC_INTERNAL_PORT ?? 8788);
const appsDir = process.env.ANBARIC_APPS_DIR ?? "/tmp/anbaric-apps";

// Generates user docs from an app's source on deploy; no-ops without an AI
// gateway token. The build layer calls it fire-and-forget off the deploy path.
const docGenerator = new DocGenerator(new GatewayDocModel(), new PostgresAppDocsStore(pool));

const buildLayer = process.env.ANBARIC_BUILD_LAYER === "docker"
    ? new DockerBuildLayer(appsDir, {
        baseImage: process.env.ANBARIC_APP_BASE_IMAGE ?? "anbaric-v2-platform:local",
        network: process.env.ANBARIC_DOCKER_NETWORK ?? "anbaric-v2-local",
        platformUrl: process.env.ANBARIC_PLATFORM_INTERNAL_URL ?? `http://localhost:${internalPort}`,
        sqlDatabaseUrl: process.env.ANBARIC_APP_SQL_DATABASE_URL,
        sqlSchema: process.env.ANBARIC_SQL_SCHEMA,
        docGenerator,
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
        appsLogGroupArn: process.env.ANBARIC_AWS_APPS_LOG_GROUP_ARN!,
        platformUrl: process.env.ANBARIC_PLATFORM_INTERNAL_URL!,
        servicesUrl: process.env.ANBARIC_SERVICES_URL,
        servicesApiKey: process.env.ANBARIC_SERVICES_API_KEY,
        sqlDatabaseUrlSecretArn: process.env.ANBARIC_AWS_APP_SQL_URL_SECRET,
        sqlSchema: process.env.ANBARIC_SQL_SCHEMA,
        docGenerator,
    })
    : undefined;

// Secrets are owned by an app: each app gets its own namespace. AWS-backed
// stores fold the app into their name prefix (stateless, built per request);
// the in-memory local store is cached per app so its data persists.
const secretsManagerClient = process.env.AWS_REGION ? new SecretsManagerClient({}) : undefined;
const localSecretStores = new Map<string, InMemorySecretStore>();
const secretStoreFor = (appId : string) : SecretStore =>
    secretsManagerClient
        ? new SecretsManagerSecretStore(secretsManagerClient, `anbaric/${appId}/`)
        : localSecretStores.get(appId) ?? localSecretStores.set(appId, new InMemorySecretStore()).get(appId)!;

const authenticator = await loadAuthenticator(process.env.ANBARIC_AUTHENTICATOR);
const cliKeyStore = process.env.ANBARIC_CLI_KEY_LOOKUP_URL
    ? new HttpCliKeyStore(process.env.ANBARIC_CLI_KEY_LOOKUP_URL, process.env.ANBARIC_CLI_KEY_LOOKUP_SECRET ?? "")
    : new PostgresCliKeyStore(pool);
const cliAuthorizer = new CliAuthorizer(cliKeyStore);
const tokenAuthenticator = new TokenAuthenticator(cliKeyStore, process.env.ANBARIC_TENANT);

const plugins = await new PluginLoader().load(process.env.ANBARIC_PLUGINS ?? "anbaric-plugins/state-machines");

// Invitations are managed by the central login that issued this tenant, which
// is the same service the CLI key lookup already points at.
const memberships = process.env.ANBARIC_CLI_KEY_LOOKUP_URL && process.env.ANBARIC_TENANT
    ? new HttpMembershipService(process.env.ANBARIC_CLI_KEY_LOOKUP_URL, process.env.ANBARIC_CLI_KEY_LOOKUP_SECRET ?? "", process.env.ANBARIC_TENANT)
    : undefined;

const server = new HostingServer(new PostgresJobPersistence(pool), queue, registry, buildLayer,
    (appId, collection) => new PostgresJsonStore(pool, appId, collection), secretStoreFor, authenticator, cliAuthorizer,
    tokenAuthenticator, process.env.ANBARIC_TENANT, new PostgresAuditRecordStore(pool), plugins,
    new PostgresJobRunSchedulePersistence(pool), await loadNotifier(process.env.ANBARIC_NOTIFIER_MODULE),
    new PostgresEntitlementStore(pool), new PostgresUserDirectory(pool), memberships,
    (appId) => new PostgresPromptManager(pool, appId));
const port = await server.listen(hostingPort);
const internal = await server.listenInternal(internalPort);

const dispatcher = new Dispatcher(queue, registry, Number(process.env.ANBARIC_DISPATCH_INTERVAL_MS ?? 1000));
dispatcher.start();

console.log(`anbaric-cloud-hosting listening on port ${port}, internal entry point on ${internal}`);
