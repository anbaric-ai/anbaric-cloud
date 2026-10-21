/* What a builder has chosen for an app beyond its code: the things set in
   the console that a redeploy must not forget. Kept by the platform rather
   than inferred from the running infrastructure, so changing one never
   restarts anything. */
type AppSettings = {
    appName : string,
    /* A deploy brings the new version up beside the old and only then lets
       the old go, instead of stopping the old first. Priced, and off unless
       the builder turns it on. */
    zeroDowntime : boolean,
    /* Anyone may open the app without signing in: no session and no access
       entitlement. Members are still recognised, so other entitlements
       apply. Priced, and off unless the builder turns it on. */
    public : boolean,
};

const DEFAULT_SETTINGS : Omit<AppSettings, "appName"> = { zeroDowntime: false, public: false };

interface AppSettingsStore {

    // The defaults for an app nobody has configured.
    get(appName : string) : Promise<AppSettings>;

    set(appName : string, settings : Partial<Omit<AppSettings, "appName">>) : Promise<AppSettings>;

    list() : Promise<Array<AppSettings>>;

    // Forgotten with the app, so a later app of the same name starts afresh.
    remove(appName : string) : Promise<void>;

}

export type { AppSettings, AppSettingsStore };
export { DEFAULT_SETTINGS };
