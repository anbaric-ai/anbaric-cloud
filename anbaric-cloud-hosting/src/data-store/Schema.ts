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
            status       TEXT NOT NULL DEFAULT 'active',
            inserted_at  BIGINT GENERATED ALWAYS AS IDENTITY
        )
    `);
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workflow_id TEXT");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_by TEXT NOT NULL DEFAULT 'system'");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ NOT NULL DEFAULT now()");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transitions JSONB NOT NULL DEFAULT '[]'");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS killed BOOLEAN NOT NULL DEFAULT false");
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'");
    // A workflow is keyed by the composite (app_id, workflow_id). Older rows
    // stored "appId/workflowId" in workflow_id; split that once into the two
    // columns (best effort - a bare workflow id with no app is left as-is).
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS app_id TEXT");
    await pool.query(`UPDATE jobs
        SET app_id = split_part(workflow_id, '/', 1),
            workflow_id = substring(workflow_id from position('/' in workflow_id) + 1)
        WHERE app_id IS NULL AND workflow_id LIKE '%/%'`);
    // The await a job is parked on; its metadata is normalised here rather than on the job.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS awaits (
            id         UUID PRIMARY KEY,
            metadata   JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS waiting_for UUID REFERENCES awaits(id) ON DELETE SET NULL");
    await pool.query(`
        CREATE TABLE IF NOT EXISTS documents (
            app_id      TEXT NOT NULL DEFAULT '',
            collection  TEXT NOT NULL,
            id          TEXT NOT NULL,
            document    JSONB NOT NULL,
            inserted_at BIGINT GENERATED ALWAYS AS IDENTITY,
            PRIMARY KEY (app_id, collection, id)
        )
    `);
    // Documents are owned by an app: widen the key to (app_id, collection, id).
    await pool.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS app_id TEXT NOT NULL DEFAULT ''");
    await pool.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage
                       WHERE table_name = 'documents' AND constraint_name = 'documents_pkey'
                         AND column_name = 'app_id') THEN
            ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_pkey;
            ALTER TABLE documents ADD PRIMARY KEY (app_id, collection, id);
        END IF;
    END $$`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS queue (
            position     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            job_id       TEXT NOT NULL,
            workflow_id  TEXT NOT NULL,
            due          TIMESTAMPTZ,
            leased_until TIMESTAMPTZ
        )
    `);
    await pool.query("ALTER TABLE queue ADD COLUMN IF NOT EXISTS app_id TEXT");
    await pool.query("ALTER TABLE queue ADD COLUMN IF NOT EXISTS retry_at TIMESTAMPTZ");
    await pool.query("ALTER TABLE queue ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0");
    await pool.query(`UPDATE queue
        SET app_id = split_part(workflow_id, '/', 1),
            workflow_id = substring(workflow_id from position('/' in workflow_id) + 1)
        WHERE app_id IS NULL AND workflow_id LIKE '%/%'`);
    // Runs a scheduler has planned. Unique on (app_id, workflow_id, run_at) so
    // two schedulers planning the same window converge on one row rather than
    // starting a machine twice.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS job_run_schedule (
            id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            app_id      TEXT NOT NULL DEFAULT '',
            workflow_id TEXT NOT NULL,
            run_at      TIMESTAMPTZ NOT NULL,
            claimed_at  TIMESTAMPTZ
        )
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS job_run_schedule_run
        ON job_run_schedule (app_id, workflow_id, run_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS job_run_schedule_due
        ON job_run_schedule (run_at) WHERE claimed_at IS NULL`);
    // User documentation the platform generates from an app's source on deploy,
    // keyed by (app_id, slug) and held as a shallow tree: a root doc has a null
    // parent_slug, a child names its parent's slug, and position orders
    // siblings. A redeploy replaces the whole set for an app.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS app_docs (
            app_id       TEXT NOT NULL,
            slug         TEXT NOT NULL,
            title        TEXT NOT NULL DEFAULT '',
            markdown     TEXT NOT NULL,
            parent_slug  TEXT,
            position     INTEGER NOT NULL DEFAULT 0,
            generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (app_id, slug)
        )
    `);
    await pool.query("ALTER TABLE app_docs ADD COLUMN IF NOT EXISTS parent_slug TEXT");
    await pool.query("ALTER TABLE app_docs ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0");
    await pool.query(`
        CREATE TABLE IF NOT EXISTS entitlements (
            app_id          TEXT,
            entitlement_id  TEXT NOT NULL,
            notes           TEXT NOT NULL DEFAULT '',
            registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS entitlements_key
        ON entitlements (COALESCE(app_id, ''), entitlement_id)
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS entitlement_grants (
            id              TEXT PRIMARY KEY,
            user_id         TEXT NOT NULL,
            app_id          TEXT,
            entitlement_id  TEXT NOT NULL,
            notes           TEXT NOT NULL DEFAULT '',
            granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            granted_by      TEXT NOT NULL
        )
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS entitlement_grants_lookup
        ON entitlement_grants (user_id, entitlement_id)
    `);
    await pool.query(`
        INSERT INTO entitlements (app_id, entitlement_id, notes)
        VALUES (NULL, 'access', 'Global access')
        ON CONFLICT (COALESCE(app_id, ''), entitlement_id) DO NOTHING
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS prompts (
            app_id         TEXT NOT NULL,
            prompt_id      TEXT NOT NULL,
            version        INTEGER NOT NULL,
            instructions   TEXT NOT NULL,
            output_schema  JSONB,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (app_id, prompt_id, version)
        )
    `);
    await pool.query("ALTER TABLE prompts DROP COLUMN IF EXISTS input_schema");
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
        CREATE TABLE IF NOT EXISTS anbaric_system.users (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL DEFAULT '',
            email       TEXT NOT NULL DEFAULT '',
            picture     TEXT,
            first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
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
            interaction   TEXT[] NOT NULL,
            description   TEXT NOT NULL,
            details       JSONB,
            at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    await pool.query("ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS resource_type TEXT");
    await pool.query("ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS resource_id TEXT");
    // The app that owns the audited resource; part of every resource's composite identity.
    await pool.query("ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS app_id TEXT");
    await pool.query("ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS interaction TEXT[]");
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
    await pool.query(`
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'anbaric_system' AND table_name = 'audit_records'
                         AND column_name = 'interaction' AND udt_name = '_audit_interaction') THEN
                ALTER TABLE anbaric_system.audit_records
                    ALTER COLUMN interaction TYPE TEXT[] USING interaction::text[];
            END IF;
        END $$
    `);
    await pool.query("UPDATE anbaric_system.audit_records SET resource_type = 'job' WHERE resource_type IS NULL");
    await pool.query("UPDATE anbaric_system.audit_records SET resource_id = 'unknown' WHERE resource_id IS NULL");
    await pool.query("UPDATE anbaric_system.audit_records SET interaction = ARRAY['UPDATE_PROPERTIES']::text[] WHERE interaction IS NULL");
    await pool.query("ALTER TABLE anbaric_system.audit_records ALTER COLUMN resource_type SET NOT NULL");
    await pool.query("ALTER TABLE anbaric_system.audit_records ALTER COLUMN resource_id SET NOT NULL");
    await pool.query("ALTER TABLE anbaric_system.audit_records ALTER COLUMN interaction SET NOT NULL");
    await pool.query("CREATE INDEX IF NOT EXISTS audit_records_resource ON anbaric_system.audit_records (resource_type, resource_id)");

    // The shared SQL store for apps: a dedicated schema plus a login role scoped
    // to it, so deployed apps reach only anbaric_app_data - never the platform's
    // public (jobs/documents/queue) or anbaric_system schemas.
    const appSqlSchema = process.env.ANBARIC_SQL_SCHEMA ?? "anbaric_app_data";
    if (!/^[a-z_][a-z0-9_]*$/i.test(appSqlSchema)) throw new Error(`Invalid ANBARIC_SQL_SCHEMA "${appSqlSchema}"`);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${appSqlSchema}`);

    const appDbPassword = process.env.ANBARIC_APP_DB_PASSWORD;
    if (appDbPassword) {
        await pool.query(`DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anbaric_app') THEN CREATE ROLE anbaric_app LOGIN; END IF;
        END $$`);
        await pool.query(`ALTER ROLE anbaric_app LOGIN PASSWORD '${appDbPassword.replace(/'/g, "''")}'`);
        await pool.query(`ALTER ROLE anbaric_app SET search_path TO ${appSqlSchema}`);
        await pool.query(`GRANT USAGE, CREATE ON SCHEMA ${appSqlSchema} TO anbaric_app`);
        await pool.query(`GRANT ALL ON ALL TABLES IN SCHEMA ${appSqlSchema} TO anbaric_app`);
        await pool.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA ${appSqlSchema} TO anbaric_app`);
        await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${appSqlSchema} GRANT ALL ON TABLES TO anbaric_app`);
        await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${appSqlSchema} GRANT ALL ON SEQUENCES TO anbaric_app`);
        await pool.query("REVOKE ALL ON SCHEMA public FROM anbaric_app");
        await pool.query("REVOKE ALL ON SCHEMA anbaric_system FROM anbaric_app");
    }
};

export { ensureSchema }
