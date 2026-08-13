import {Pool} from "pg";
import {ensureSchema} from "./Schema";
import {PostgresJobPersistence} from "./PostgresJobPersistence";
import {PostgresQueue} from "./PostgresQueue";
import {HostingServer} from "./HostingServer";

const pool = new Pool({ connectionString: process.env.ANBARIC_DATABASE_URL });
await ensureSchema(pool);

const server = new HostingServer(new PostgresJobPersistence(pool), new PostgresQueue(pool));
const port = await server.listen(Number(process.env.ANBARIC_HOSTING_PORT ?? 8787));

console.log(`anbaric-cloud-hosting listening on port ${port}`);
