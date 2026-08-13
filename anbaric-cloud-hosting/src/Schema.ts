import {Pool} from "pg";

const ensureSchema = async (pool : Pool) : Promise<void> => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS jobs (
            id          TEXT PRIMARY KEY,
            state       TEXT NOT NULL,
            properties  JSONB NOT NULL DEFAULT '{}',
            inserted_at BIGINT GENERATED ALWAYS AS IDENTITY
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
