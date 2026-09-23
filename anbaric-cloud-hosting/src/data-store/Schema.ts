import {Pool} from "pg";
import {migrate} from "./Migrations";
import {PLATFORM_MIGRATIONS} from "./PlatformMigrations";

/* Brings the database up to date at boot. The platform owns its own database
   and nothing else: app data lives in a separate cluster, and the role that
   reaches it is created alongside that database rather than here, so the
   platform never holds a credential that can make roles. */
const ensureSchema = async (pool : Pool) : Promise<void> => {
    const applied = await migrate(pool, PLATFORM_MIGRATIONS);
    if (applied.length > 0) console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
};

export { ensureSchema }
