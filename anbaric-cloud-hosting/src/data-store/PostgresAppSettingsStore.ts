import {Pool} from "pg";
import {AppSettings, AppSettingsStore, DEFAULT_SETTINGS} from "./AppSettingsStore";

const rowToSettings = (row : any) : AppSettings => ({
    appName: row.app_name,
    zeroDowntime: row.zero_downtime,
});

class PostgresAppSettingsStore implements AppSettingsStore {

    constructor(private pool : Pool) {}

    async get(appName : string) : Promise<AppSettings> {
        const result = await this.pool.query(
            "SELECT app_name, zero_downtime FROM app_settings WHERE app_name = $1", [appName]);
        return result.rows[0] ? rowToSettings(result.rows[0]) : { appName, ...DEFAULT_SETTINGS };
    }

    async set(appName : string, settings : Partial<Omit<AppSettings, "appName">>) : Promise<AppSettings> {
        const merged = { ...(await this.get(appName)), ...settings };
        const result = await this.pool.query(
            `INSERT INTO app_settings (app_name, zero_downtime) VALUES ($1, $2)
             ON CONFLICT (app_name) DO UPDATE SET zero_downtime = EXCLUDED.zero_downtime, updated_at = now()
             RETURNING app_name, zero_downtime`,
            [appName, merged.zeroDowntime]);
        return rowToSettings(result.rows[0]);
    }

    async list() : Promise<Array<AppSettings>> {
        const result = await this.pool.query("SELECT app_name, zero_downtime FROM app_settings ORDER BY app_name");
        return result.rows.map(rowToSettings);
    }

    async remove(appName : string) : Promise<void> {
        await this.pool.query("DELETE FROM app_settings WHERE app_name = $1", [appName]);
    }

}

export { PostgresAppSettingsStore };
