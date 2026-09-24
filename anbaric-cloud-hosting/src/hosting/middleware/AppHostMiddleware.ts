import {AppProxyHandler} from "../handlers/AppProxyHandler";
import {Middleware} from "../Middleware";
import {Request} from "../Request";

/* An app reached by its own hostname is served at the root of it, so a page
   that asks for /styles.css or calls fetch("/api/thing") works exactly as it
   did on the author's machine. Under /app/<name> those same requests escape the
   app and land on the platform, which is why an app built locally has to be
   rewritten before it can be deployed - the thing this removes.

   The edge resolves the hostname and names the app in a header; it overwrites
   whatever the client sent, so this is not something a caller can choose. Even
   if it were, naming an app is not a privilege: the same app is reachable at
   /app/<name> anyway, and the platform authenticates either way. */
const APP_HOST_HEADER = "x-anbaric-app-host";

class AppHostMiddleware implements Middleware {

    constructor(private proxy : AppProxyHandler | undefined) {}

    async apply(request : Request) : Promise<boolean> {
        const appName = String(request.header(APP_HOST_HEADER) ?? "").trim();
        if (! this.proxy || ! appName) return true;

        await this.proxy.serveAtRoot(request, appName);
        return false;
    }

}

export { AppHostMiddleware, APP_HOST_HEADER };
