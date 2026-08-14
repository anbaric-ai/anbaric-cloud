import {SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {SecretStore} from "anbaric-tsapi";
import {InMemorySecretStore} from "anbaric-data-store";
import {Pool} from "pg";
import {ensureSchema} from "./Schema";
import {SecretsManagerSecretStore} from "./SecretsManagerSecretStore";
import {PostgresJobPersistence} from "./PostgresJobPersistence";
import {PostgresJsonStore} from "./PostgresJsonStore";
import {PostgresQueue} from "./PostgresQueue";
import {BuildLayer} from "./BuildLayer";
import {ConsumerRegistry} from "./ConsumerRegistry";
import {Dispatcher} from "./Dispatcher";
import {HostingServer} from "./HostingServer";

const pool = new Pool({ connectionString: process.env.ANBARIC_DATABASE_URL });
await ensureSchema(pool);

const queue = new PostgresQueue(pool);
const registry = new ConsumerRegistry();

const hostingPort = Number(process.env.ANBARIC_HOSTING_PORT ?? 8787);
const buildLayer = new BuildLayer(
    process.env.ANBARIC_APPS_DIR ?? "/tmp/anbaric-apps",
    `http://localhost:${hostingPort}`,
);

const secretStore : SecretStore = process.env.AWS_REGION
    ? new SecretsManagerSecretStore(new SecretsManagerClient({}))
    : new InMemorySecretStore();

const server = new HostingServer(new PostgresJobPersistence(pool), queue, registry, buildLayer,
    (collection) => new PostgresJsonStore(pool, collection), secretStore);
const port = await server.listen(hostingPort);

const dispatcher = new Dispatcher(queue, registry, Number(process.env.ANBARIC_DISPATCH_INTERVAL_MS ?? 1000));
dispatcher.start();

console.log(`anbaric-cloud-hosting listening on port ${port}`);
