import {Pool} from "pg";

/* Workflow data (jobs, queue, documents) lives in the default public schema;
   platform system tables are encapsulated in the anbaric_system schema so the
   two never mix. */
const ensureSchema = async (pool : Pool) : Promise<void> => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS jobs (
            id           TEXT PRIMARY KEY,
            state        TEXT NOT NULL,
            properties   JSONB NOT NULL DEFAULT '{}',
            workflow_id  TEXT,
            started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            started_by   TEXT NOT NULL DEFAULT 'system',
            last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
            transitions  JSONB NOT NULL DEFAULT '[]',
            inserted_at  BIGINT GENERATED ALWAYS AS IDENTITY
        )
    `);
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workflow_id TEXT");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_by TEXT NOT NULL DEFAULT 'system'");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ NOT NULL DEFAULT now()");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transitions JSONB NOT NULL DEFAULT '[]'");
    await pool.query(`
        CREATE TABLE IF NOT EXISTS documents (
            collection  TEXT NOT NULL,
            id          TEXT NOT NULL,
            document    JSONB NOT NULL,
            inserted_at BIGINT GENERATED ALWAYS AS IDENTITY,
            PRIMARY KEY (collection, id)
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS queue (
            position     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            job_id       TEXT NOT NULL,
            workflow_id  TEXT NOT NULL,
            due          TIMESTAMPTZ,
            leased_until TIMESTAMPTZ
        )
    `);
    await pool.query("CREATE SCHEMA IF NOT EXISTS anbaric_system");
    await pool.query(`
        CREATE TABLE IF NOT EXISTS anbaric_system.cli_keys (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            client_name TEXT NOT NULL,
            public_key  TEXT NOT NULL,
            tenant      TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    await pool.query("ALTER TABLE anbaric_system.cli_keys ADD COLUMN IF NOT EXISTS tenant TEXT");
    await pool.query(`
        DO $$ BEGIN
            CREATE TYPE anbaric_system.audit_change AS ENUM ('CREATE', 'UPDATE_PROPERTIES', 'CHANGE_STATE', 'DELETE');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS anbaric_system.audit_records (
            id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            job_id      TEXT NOT NULL,
            actor_id    TEXT NOT NULL,
            actor_type  TEXT NOT NULL,
            change      anbaric_system.audit_change NOT NULL,
            description TEXT NOT NULL,
            details     JSONB,
            at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    await pool.query("ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS change anbaric_system.audit_change");
    await pool.query("UPDATE anbaric_system.audit_records SET change = 'UPDATE_PROPERTIES' WHERE change IS NULL");
    await pool.query("UPDATE anbaric_system.audit_records SET actor_id = 'system' WHERE actor_id IS NULL");
    await pool.query("UPDATE anbaric_system.audit_records SET actor_type = 'CODE' WHERE actor_type IS NULL");
    await pool.query("ALTER TABLE anbaric_system.audit_records ALTER COLUMN change SET NOT NULL");
    await pool.query("ALTER TABLE anbaric_system.audit_records ALTER COLUMN actor_id SET NOT NULL");
    await pool.query("ALTER TABLE anbaric_system.audit_records ALTER COLUMN actor_type SET NOT NULL");
    await pool.query("CREATE INDEX IF NOT EXISTS audit_records_job_id ON anbaric_system.audit_records (job_id)");
};

export { ensureSchema }
