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
import {ProcessBuildLayer} from "./app-management/ProcessBuildLayer";
import {ConsumerRegistry} from "./queuing/ConsumerRegistry";
import {Dispatcher} from "./queuing/Dispatcher";
import {HostingServer} from "./hosting/HostingServer";

const pool = new Pool({ connectionString: process.env.ANBARIC_DATABASE_URL });
await ensureSchema(pool);

const queue = new PostgresQueue(pool);
const registry = new ConsumerRegistry();

const hostingPort = Number(process.env.ANBARIC_HOSTING_PORT ?? 8787);
const appsDir = process.env.ANBARIC_APPS_DIR ?? "/tmp/anbaric-apps";

const buildLayer = process.env.ANBARIC_BUILD_LAYER === "docker"
    ? new DockerBuildLayer(appsDir, {
        baseImage: process.env.ANBARIC_APP_BASE_IMAGE ?? "anbaric-v2-platform:local",
        network: process.env.ANBARIC_DOCKER_NETWORK ?? "anbaric-v2-local",
        platformUrl: process.env.ANBARIC_PLATFORM_INTERNAL_URL ?? `http://localhost:${hostingPort}`,
    })
    : new ProcessBuildLayer(appsDir, `http://localhost:${hostingPort}`);

const secretStore : SecretStore = process.env.AWS_REGION
    ? new SecretsManagerSecretStore(new SecretsManagerClient({}))
    : new InMemorySecretStore();

const authenticator = await loadAuthenticator(process.env.ANBARIC_AUTHENTICATOR);
const cliKeyStore = new PostgresCliKeyStore(pool);
const cliAuthorizer = new CliAuthorizer(cliKeyStore);
const tokenAuthenticator = new TokenAuthenticator(cliKeyStore);

const server = new HostingServer(new PostgresJobPersistence(pool), queue, registry, buildLayer,
    (collection) => new PostgresJsonStore(pool, collection), secretStore, authenticator, cliAuthorizer,
    tokenAuthenticator);
const port = await server.listen(hostingPort);

const dispatcher = new Dispatcher(queue, registry, Number(process.env.ANBARIC_DISPATCH_INTERVAL_MS ?? 1000));
dispatcher.start();

console.log(`anbaric-cloud-hosting listening on port ${port}`);
