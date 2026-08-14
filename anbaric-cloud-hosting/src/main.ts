import {Pool} from "pg";
import {ensureSchema} from "./Schema";
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

const server = new HostingServer(new PostgresJobPersistence(pool), queue, registry, buildLayer,
    (collection) => new PostgresJsonStore(pool, collection));
const port = await server.listen(hostingPort);

const dispatcher = new Dispatcher(queue, registry, Number(process.env.ANBARIC_DISPATCH_INTERVAL_MS ?? 1000));
dispatcher.start();

console.log(`anbaric-cloud-hosting listening on port ${port}`);
