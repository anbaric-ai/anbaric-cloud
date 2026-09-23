import {Pool, PoolClient} from "pg";

type Migration = {

    /* A stable identifier, recorded once the migration has run. Never reuse or
       rename one: the record is the only thing standing between a second boot
       and running the same change twice. Numbered prefixes keep the order
       obvious to a reader ("003-tenant-roles"). */
    id : string,

    run : (client : PoolClient) => Promise<void>,

};

const TABLE = "anbaric_schema_migrations";

// One well-known lock, so two instances booting together take it in turns
// rather than racing to apply the same migration.
const LOCK_KEY = 8_233_120;

/* Applies whatever has not been applied yet, in order, each in its own
   transaction. A migration that throws stops the boot: coming up against a
   half-changed database is worse than not coming up at all. */
const migrate = async (pool : Pool, migrations : Array<Migration>) : Promise<Array<string>> => {
    const duplicate = migrations.find((migration, at) => migrations.findIndex(other => other.id === migration.id) !== at);
    if (duplicate) throw new Error(`Duplicate migration id "${duplicate.id}"`);

    const client = await pool.connect();
    const applied : Array<string> = [];

    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${TABLE} (
                id         TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);
        await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);

        const done = new Set((await client.query(`SELECT id FROM ${TABLE}`)).rows.map(row => row.id));

        for (const migration of migrations) {
            if (done.has(migration.id)) continue;

            try {
                await client.query("BEGIN");
                await migration.run(client);
                await client.query(`INSERT INTO ${TABLE} (id) VALUES ($1)`, [migration.id]);
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK").catch(() => {});
                throw new Error(`Migration "${migration.id}" failed: ${error instanceof Error ? error.message : error}`);
            }
            applied.push(migration.id);
        }

        return applied;
    } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
        client.release();
    }
};

/* The common case: a migration that is just SQL. Several statements may be
   given, and they run in the one transaction the migration already has. */
const statements = (id : string, ...sql : Array<string>) : Migration => ({
    id,
    run: async (client) => {
        for (const statement of sql) await client.query(statement);
    },
});

export { migrate, statements };
export type { Migration };
