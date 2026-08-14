import {Pool} from "pg";

const ensureSchema = async (pool : Pool) : Promise<void> => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS jobs (
            id          TEXT PRIMARY KEY,
            state       TEXT NOT NULL,
            properties  JSONB NOT NULL DEFAULT '{}',
            workflow_id TEXT,
            inserted_at BIGINT GENERATED ALWAYS AS IDENTITY
        )
    `);
    await pool.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workflow_id TEXT");
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
};

export { ensureSchema }
