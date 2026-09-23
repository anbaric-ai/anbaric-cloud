import {Migration, statements} from "./Migrations";

/* Workflow data (jobs, queue, documents) lives in the default public schema;
   platform system tables are encapsulated in the anbaric_system schema so the
   two never mix.

   The baseline is everything the schema had grown to before migrations were
   recorded, so it is written defensively (IF NOT EXISTS, guarded DO blocks) and
   is safe against a database that already has all of it. Everything after it is
   a numbered step that runs exactly once: write new changes as plain SQL and
   never edit a migration that has shipped. */
const PLATFORM_MIGRATIONS : Array<Migration> = [

    statements("001-baseline",
        `CREATE TABLE IF NOT EXISTS jobs (
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
        )`,
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workflow_id TEXT",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT now()",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_by TEXT NOT NULL DEFAULT 'system'",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ NOT NULL DEFAULT now()",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transitions JSONB NOT NULL DEFAULT '[]'",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS killed BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS app_id TEXT",
        `UPDATE jobs
            SET app_id = split_part(workflow_id, '/', 1),
                workflow_id = substring(workflow_id from position('/' in workflow_id) + 1)
            WHERE app_id IS NULL AND workflow_id LIKE '%/%'`,
        `CREATE TABLE IF NOT EXISTS awaits (
            id         UUID PRIMARY KEY,
            metadata   JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS waiting_for UUID REFERENCES awaits(id) ON DELETE SET NULL",
        `CREATE TABLE IF NOT EXISTS documents (
            app_id      TEXT NOT NULL DEFAULT '',
            collection  TEXT NOT NULL,
            id          TEXT NOT NULL,
            document    JSONB NOT NULL,
            inserted_at BIGINT GENERATED ALWAYS AS IDENTITY,
            PRIMARY KEY (app_id, collection, id)
        )`,
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS app_id TEXT NOT NULL DEFAULT ''",
        `DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage
                           WHERE table_name = 'documents' AND constraint_name = 'documents_pkey'
                             AND column_name = 'app_id') THEN
                ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_pkey;
                ALTER TABLE documents ADD PRIMARY KEY (app_id, collection, id);
            END IF;
        END $$`,
        `CREATE TABLE IF NOT EXISTS queue (
            position     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            job_id       TEXT NOT NULL,
            workflow_id  TEXT NOT NULL,
            due          TIMESTAMPTZ,
            leased_until TIMESTAMPTZ
        )`,
        "ALTER TABLE queue ADD COLUMN IF NOT EXISTS app_id TEXT",
        "ALTER TABLE queue ADD COLUMN IF NOT EXISTS retry_at TIMESTAMPTZ",
        "ALTER TABLE queue ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0",
        `UPDATE queue
            SET app_id = split_part(workflow_id, '/', 1),
                workflow_id = substring(workflow_id from position('/' in workflow_id) + 1)
            WHERE app_id IS NULL AND workflow_id LIKE '%/%'`,
        `CREATE TABLE IF NOT EXISTS job_run_schedule (
            id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            app_id      TEXT NOT NULL DEFAULT '',
            workflow_id TEXT NOT NULL,
            run_at      TIMESTAMPTZ NOT NULL,
            claimed_at  TIMESTAMPTZ
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS job_run_schedule_run
            ON job_run_schedule (app_id, workflow_id, run_at)`,
        `CREATE INDEX IF NOT EXISTS job_run_schedule_due
            ON job_run_schedule (run_at) WHERE claimed_at IS NULL`,
        `CREATE TABLE IF NOT EXISTS app_docs (
            app_id       TEXT NOT NULL,
            slug         TEXT NOT NULL,
            title        TEXT NOT NULL DEFAULT '',
            markdown     TEXT NOT NULL,
            parent_slug  TEXT,
            position     INTEGER NOT NULL DEFAULT 0,
            generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (app_id, slug)
        )`,
        "ALTER TABLE app_docs ADD COLUMN IF NOT EXISTS parent_slug TEXT",
        "ALTER TABLE app_docs ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0",
        `CREATE TABLE IF NOT EXISTS entitlements (
            app_id          TEXT,
            entitlement_id  TEXT NOT NULL,
            notes           TEXT NOT NULL DEFAULT '',
            registered_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS entitlements_key
            ON entitlements (COALESCE(app_id, ''), entitlement_id)`,
        `CREATE TABLE IF NOT EXISTS entitlement_grants (
            id              TEXT PRIMARY KEY,
            user_id         TEXT NOT NULL,
            app_id          TEXT,
            entitlement_id  TEXT NOT NULL,
            notes           TEXT NOT NULL DEFAULT '',
            granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            granted_by      TEXT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS entitlement_grants_lookup
            ON entitlement_grants (user_id, entitlement_id)`,
        `INSERT INTO entitlements (app_id, entitlement_id, notes)
            VALUES (NULL, 'access', 'Global access')
            ON CONFLICT (COALESCE(app_id, ''), entitlement_id) DO NOTHING`,
        `CREATE TABLE IF NOT EXISTS prompts (
            app_id         TEXT NOT NULL,
            prompt_id      TEXT NOT NULL,
            version        INTEGER NOT NULL,
            instructions   TEXT NOT NULL,
            output_schema  JSONB,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (app_id, prompt_id, version)
        )`,
        "ALTER TABLE prompts DROP COLUMN IF EXISTS input_schema",
        "CREATE SCHEMA IF NOT EXISTS anbaric_system",
        `CREATE TABLE IF NOT EXISTS anbaric_system.cli_keys (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL,
            client_name TEXT NOT NULL,
            public_key  TEXT NOT NULL,
            tenant      TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        "ALTER TABLE anbaric_system.cli_keys ADD COLUMN IF NOT EXISTS tenant TEXT",
        `CREATE TABLE IF NOT EXISTS anbaric_system.users (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL DEFAULT '',
            email       TEXT NOT NULL DEFAULT '',
            picture     TEXT,
            first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        `DO $$ BEGIN
            CREATE TYPE anbaric_system.audit_interaction AS ENUM
                ('CREATE', 'UPDATE_PROPERTIES', 'CHANGE_STATE', 'DELETE', 'READ', 'LIST');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$`,
        `CREATE TABLE IF NOT EXISTS anbaric_system.audit_records (
            id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            resource_type TEXT NOT NULL,
            resource_id   TEXT NOT NULL,
            actor_id      TEXT NOT NULL,
            actor_type    TEXT NOT NULL,
            interaction   TEXT[] NOT NULL,
            description   TEXT NOT NULL,
            details       JSONB,
            at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )`,
        "ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS resource_type TEXT",
        "ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS resource_id TEXT",
        "ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS app_id TEXT",
        "ALTER TABLE anbaric_system.audit_records ADD COLUMN IF NOT EXISTS interaction TEXT[]",
        `DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'anbaric_system' AND table_name = 'audit_records'
                         AND column_name = 'interaction' AND data_type <> 'ARRAY') THEN
                ALTER TABLE anbaric_system.audit_records
                    ALTER COLUMN interaction TYPE anbaric_system.audit_interaction[] USING ARRAY[interaction];
            END IF;
        END $$`,
        `DO $$ BEGIN
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
        END $$`,
        `DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'anbaric_system' AND table_name = 'audit_records'
                         AND column_name = 'interaction' AND udt_name = '_audit_interaction') THEN
                ALTER TABLE anbaric_system.audit_records
                    ALTER COLUMN interaction TYPE TEXT[] USING interaction::text[];
            END IF;
        END $$`,
        "UPDATE anbaric_system.audit_records SET resource_type = 'job' WHERE resource_type IS NULL",
        "UPDATE anbaric_system.audit_records SET resource_id = 'unknown' WHERE resource_id IS NULL",
        "UPDATE anbaric_system.audit_records SET interaction = ARRAY['UPDATE_PROPERTIES']::text[] WHERE interaction IS NULL",
        "ALTER TABLE anbaric_system.audit_records ALTER COLUMN resource_type SET NOT NULL",
        "ALTER TABLE anbaric_system.audit_records ALTER COLUMN resource_id SET NOT NULL",
        "ALTER TABLE anbaric_system.audit_records ALTER COLUMN interaction SET NOT NULL",
        "CREATE INDEX IF NOT EXISTS audit_records_resource ON anbaric_system.audit_records (resource_type, resource_id)",
    ),

];

export { PLATFORM_MIGRATIONS };
