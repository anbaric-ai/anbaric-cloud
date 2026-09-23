import {Pool} from "pg";
import {migrate} from "./Migrations";
import {PLATFORM_MIGRATIONS} from "./PlatformMigrations";

/* Brings the database up to date at boot, then settles the app's SQL role.
   The role is not a migration: its password comes from the environment and may
   be rotated, so it is re-applied every time rather than recorded as done. */
const ensureSchema = async (pool : Pool) : Promise<void> => {
    const applied = await migrate(pool, PLATFORM_MIGRATIONS);
    if (applied.length > 0) console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);

    await ensureAppRole(pool);
};

/* The shared SQL store for apps: a dedicated schema plus a login role scoped
   to it, so deployed apps reach only anbaric_app_data - never the platform's
   public (jobs/documents/queue) or anbaric_system schemas. */
const ensureAppRole = async (pool : Pool) : Promise<void> => {
    const appSqlSchema = process.env.ANBARIC_SQL_SCHEMA ?? "anbaric_app_data";
    if (! /^[a-z_][a-z0-9_]*$/i.test(appSqlSchema)) throw new Error(`Invalid ANBARIC_SQL_SCHEMA "${appSqlSchema}"`);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${appSqlSchema}`);

    const appDbPassword = process.env.ANBARIC_APP_DB_PASSWORD;
    if (! appDbPassword) return;

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
};

export { ensureSchema }
