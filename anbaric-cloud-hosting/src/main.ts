import {SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {S3Client} from "@aws-sdk/client-s3";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {FileStorage, SecretStore} from "anbaric-tsapi";
import {InMemorySecretStore, LocalFileSystemStorage} from "anbaric-data-store";
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
import {S3FileStorage} from "./data-store/S3FileStorage";
import {PostgresJobRunSchedulePersistence} from "./data-store/PostgresJobRunSchedulePersistence";
import {PostgresJobPersistence} from "./data-store/PostgresJobPersistence";
import {StallSweep} from "./data-store/StallSweep";
import {AuditSweep, DEFAULT_RETENTION_DAYS} from "./auditing/AuditSweep";
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
import {UsageReporter} from "./usage/UsageReporter";
import {HttpSubdomains} from "./subdomains/HttpSubdomains";
import {CentralBilling} from "./billing/CentralBilling";

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
// stores fold the tenant and the app into their name prefix - Secrets Manager
// is account-wide, so the tenant is what keeps two customers' "crm" apart, and
// the task role is scoped to that same prefix. They are stateless, built per
// request; the in-memory local store is cached per app so its data persists.
const secretsManagerClient = process.env.AWS_REGION ? new SecretsManagerClient({}) : undefined;
const localSecretStores = new Map<string, InMemorySecretStore>();
const secretStoreFor = (appId : string) : SecretStore =>
    secretsManagerClient
        ? new SecretsManagerSecretStore(secretsManagerClient, `anbaric/${process.env.ANBARIC_TENANT ?? "local"}/${appId}/`)
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

/* Where this tenant's apps answer. The addresses are the control plane's to
   keep, because one has to be unique across every tenant; a platform that has
   no control plane to ask has no addresses and serves its apps by path. */
const subdomains = process.env.ANBARIC_CLI_KEY_LOOKUP_URL && process.env.ANBARIC_TENANT
    ? new HttpSubdomains(process.env.ANBARIC_CLI_KEY_LOOKUP_URL, process.env.ANBARIC_CLI_KEY_LOOKUP_SECRET ?? "", process.env.ANBARIC_TENANT)
    : undefined;

// What the tenant is spending, and where it pays: the control plane's to
// know, and only a tenant that has one can ask.
const billing = process.env.ANBARIC_CLI_KEY_LOOKUP_URL && process.env.ANBARIC_TENANT
    ? new CentralBilling(process.env.ANBARIC_CLI_KEY_LOOKUP_URL, process.env.ANBARIC_CLI_KEY_LOOKUP_SECRET ?? "", process.env.ANBARIC_TENANT)
    : undefined;

/* Files are owned by an app, like secrets: on the hosted platform each app
   gets its own key prefix in the tenant's bucket, and locally its own folder
   under the storage root. A caller with no app - the console - gets the whole
   tenant, with paths carrying the owning app's name. Both stores are
   stateless, so one is built per call. */
const filesBucket = process.env.ANBARIC_FILE_STORAGE_BUCKET;
const s3 = filesBucket ? new S3Client({}) : undefined;
const fileStorageFor = (appId : string) : FileStorage =>
    s3 && filesBucket
        ? new S3FileStorage(s3, filesBucket, appId ? `${appId}/` : "")
        : new LocalFileSystemStorage(join(process.env.ANBARIC_FILE_STORAGE_PATH ?? join(tmpdir(), "anbaric", "files"), appId));

const jobs = new PostgresJobPersistence(pool);
const auditRecords = new PostgresAuditRecordStore(pool);
const server = new HostingServer(jobs, queue, registry, buildLayer,
    (appId, collection) => new PostgresJsonStore(pool, appId, collection), secretStoreFor, authenticator, cliAuthorizer,
    tokenAuthenticator, process.env.ANBARIC_TENANT, auditRecords, plugins,
    new PostgresJobRunSchedulePersistence(pool), await loadNotifier(process.env.ANBARIC_NOTIFIER_MODULE),
    new PostgresEntitlementStore(pool), new PostgresUserDirectory(pool), memberships,
    (appId) => new PostgresPromptManager(pool, appId), fileStorageFor, subdomains, billing);
const port = await server.listen(hostingPort);
const internal = await server.listenInternal(internalPort);

const dispatcher = new Dispatcher(queue, registry, Number(process.env.ANBARIC_DISPATCH_INTERVAL_MS ?? 1000));
dispatcher.start();

/* Tells the control plane how many apps this tenant runs, which is what it is
   billed for. Only a deployed tenant has anywhere to report to; a platform run
   locally simply does not. Apps that are running or draining count - one being
   built has not run yet, and one that is stopped or failed is not running. */
if (buildLayer && process.env.ANBARIC_TENANT && process.env.ANBARIC_CLI_KEY_LOOKUP_URL) {
    new UsageReporter(
        process.env.ANBARIC_CLI_KEY_LOOKUP_URL,
        process.env.ANBARIC_CLI_KEY_LOOKUP_SECRET ?? "",
        process.env.ANBARIC_TENANT,
        () => {
            const live = buildLayer.list().filter(app => app.status === "running" || app.status === "draining");
            return { apps: live.length, large: live.filter(app => app.size === "large").length };
        },
    ).start();
}

/* Makes sure every app this platform is running has an address. Allocation is
   idempotent, so this costs one call per app and changes nothing in the
   ordinary case - but it is what gives an address to an app deployed before
   addresses existed, and what repairs one the control plane never managed to
   publish to the edge. Cheaper and harder to forget than a migration script. */
if (buildLayer && subdomains) {
    void buildLayer.ensureHydrated()
        .then(() => Promise.all(buildLayer.list().map(app => subdomains.allocate(app.appName))))
        .catch(error => console.warn(`[subdomains] could not reconcile app addresses: ${error instanceof Error ? error.message : error}`));
}

// Jobs whose long-running step stopped saying it was alive are marked, not touched.
new StallSweep(jobs).start();

/* Audit records older than the retention are removed, daily. The retention is
   in days; zero keeps everything, and an unset value keeps a year. */
new AuditSweep(auditRecords, Number(process.env.ANBARIC_AUDIT_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS)).start();

console.log(`anbaric-cloud-hosting listening on port ${port}, internal entry point on ${internal}`);
