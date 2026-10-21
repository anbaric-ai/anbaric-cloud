import {AppSettingsStore} from "../data-store/AppSettingsStore";
import {APP_HOST_HEADER, PLATFORM_PATHS} from "./middleware/AppHostMiddleware";
import {Request} from "./Request";

const REMEMBERED_MS = 5_000;

/* Anyone may name any app in a path, so what is remembered is bounded. */
const MOST_REMEMBERED = 1_000;

/* The app a request is for, by its own hostname or under /app/<name>. The
   platform's few paths on an app's hostname are the platform's, not the app's. */
const addressedApp = (request : Request) : string | undefined => {
    const byHost = String(request.header(APP_HOST_HEADER) ?? "").trim();
    if (byHost) return PLATFORM_PATHS.has(request.url.pathname) ? undefined : byHost;
    return ! request.api && request.resource === "app" ? request.id : undefined;
};

/* Which apps anyone may open without signing in. Asked on every request to
   an app, so each answer is remembered for a few seconds: turning an app
   public, or private again, takes that long to be felt. */
class PublicApps {

    private remembered = new Map<string, { open : boolean, until : number }>();

    constructor(private settings : AppSettingsStore, private now : () => number = Date.now) {}

    async includes(request : Request) : Promise<boolean> {
        const appName = addressedApp(request);
        if (! appName) return false;

        const known = this.remembered.get(appName);
        if (known && known.until > this.now()) return known.open;

        const open = (await this.settings.get(appName)).public;
        if (this.remembered.size >= MOST_REMEMBERED) this.remembered.clear();
        this.remembered.set(appName, { open, until: this.now() + REMEMBERED_MS });
        return open;
    }

}

export { PublicApps, addressedApp }
