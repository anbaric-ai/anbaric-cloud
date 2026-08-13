import {Pool} from "pg";
import {ensureSchema} from "./Schema";
import {PostgresJobPersistence} from "./PostgresJobPersistence";
import {PostgresQueue} from "./PostgresQueue";
import {ConsumerRegistry} from "./ConsumerRegistry";
import {Dispatcher} from "./Dispatcher";
import {HostingServer} from "./HostingServer";

const pool = new Pool({ connectionString: process.env.ANBARIC_DATABASE_URL });
await ensureSchema(pool);

const queue = new PostgresQueue(pool);
const registry = new ConsumerRegistry();

const server = new HostingServer(new PostgresJobPersistence(pool), queue, registry);
const port = await server.listen(Number(process.env.ANBARIC_HOSTING_PORT ?? 8787));

const dispatcher = new Dispatcher(queue, registry, Number(process.env.ANBARIC_DISPATCH_INTERVAL_MS ?? 1000));
dispatcher.start();

console.log(`anbaric-cloud-hosting listening on port ${port}`);
