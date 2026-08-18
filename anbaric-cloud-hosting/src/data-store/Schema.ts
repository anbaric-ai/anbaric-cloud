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
            CREATE TYPE anbaric_system.audit_interaction AS ENUM
                ('CREATE', 'UPDATE_PROPERTIES', 'CHANGE_STATE', 'DELETE', 'READ', 'LIST');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS anbaric_system.audit_records (
            id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            resource_type TEXT NOT NULL,
            resource_id   TEXT NOT NULL,
            actor_id      TEXT NOT NULL,
            actor_type    TEXT NOT NULL,
            interaction   anbaric_system.audit_interaction[] NOT NULL,
            description   TEXT NOT NULL,
            details       JSONB,
            at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    await pool.query("ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS resource_type TEXT");
    await pool.query("ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS resource_id TEXT");
    await pool.query("ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS interaction anbaric_system.audit_interaction[]");
    await pool.query(`
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'anbaric_system' AND table_name = 'audit_records'
                         AND column_name = 'interaction' AND data_type <> 'ARRAY') THEN
                ALTER TABLE anbaric_system.audit_records
                    ALTER COLUMN interaction TYPE anbaric_system.audit_interaction[] USING ARRAY[interaction];
            END IF;
        END $$
    `);
    await pool.query(`
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'anbaric_system' AND table_name = 'audit_records'
                         AND column_name = 'job_id') THEN
                UPDATE anbaric_system.audit_records
                    SET resource_type = COALESCE(resource_type, 'job'),
                        resource_id = COALESCE(resource_id, job_id),
                        interaction = COALESCE(interaction, ARRAY[change::text::anbaric_system.audit_interaction])
                    WHERE resource_id IS NULL OR interaction IS NULL;
                ALTER TABLE anbaric_system.audit_records DROP COLUMN job_id;
                ALTER TABLE anbaric_system.audit_records DROP COLUMN change;
            END IF;
        END $$
    `);
    await pool.query("UPDATE anbaric_system.audit_records SET resource_type = 'job' WHERE resource_type IS NULL");
    await pool.query("UPDATE anbaric_system.audit_records SET resource_id = 'unknown' WHERE resource_id IS NULL");
    await pool.query("UPDATE anbaric_system.audit_records SET interaction = ARRAY['UPDATE_PROPERTIES']::anbaric_system.audit_interaction[] WHERE interaction IS NULL");
    await pool.query("ALTER TABLE anbaric_system.audit_records ALTER COLUMN resource_type SET NOT NULL");
    await pool.query("ALTER TABLE anbaric_system.audit_records ALTER COLUMN resource_id SET NOT NULL");
    await pool.query("ALTER TABLE anbaric_system.audit_records ALTER COLUMN interaction SET NOT NULL");
    await pool.query("CREATE INDEX IF NOT EXISTS audit_records_resource ON anbaric_system.audit_records (resource_type, resource_id)");
};

export { ensureSchema }
