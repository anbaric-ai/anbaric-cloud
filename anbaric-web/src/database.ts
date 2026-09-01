import { Pool } from "pg";

/* A single lazily-created connection pool to the platform database, shared
   across every plugin data call in the process. Data functions run on the
   server; in a plugin's browser bundle pg is stubbed and this is never reached.
   Centralising it here means plugins never hand-roll their own Pool (and never
   leak one per call). */
let pool : Pool | undefined;

const database = () : Pool => (pool ??= new Pool({ connectionString: process.env.ANBARIC_DATABASE_URL }));

export { database };
