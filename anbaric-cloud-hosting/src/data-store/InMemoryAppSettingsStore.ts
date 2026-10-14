import {AppSettings, AppSettingsStore, DEFAULT_SETTINGS} from "./AppSettingsStore";

class InMemoryAppSettingsStore implements AppSettingsStore {

    private settings = new Map<string, AppSettings>();

    async get(appName : string) : Promise<AppSettings> {
        return { ...(this.settings.get(appName) ?? { appName, ...DEFAULT_SETTINGS }) };
    }

    async set(appName : string, settings : Partial<Omit<AppSettings, "appName">>) : Promise<AppSettings> {
        const updated = { ...(await this.get(appName)), ...settings, appName };
        this.settings.set(appName, updated);
        return { ...updated };
    }

    async list() : Promise<Array<AppSettings>> {
        return [...this.settings.values()].map(settings => ({ ...settings }));
    }

    async remove(appName : string) : Promise<void> {
        this.settings.delete(appName);
    }

}

export { InMemoryAppSettingsStore };
