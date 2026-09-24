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
   /app/<name> anyway, and this runs after authentication either way, so a
   hostname is a nicer address for an app and not a way around its front door. */
const APP_HOST_HEADER = "x-anbaric-app-host";

/* The only paths on an app's hostname that are not the app's. A deployed app
   sits behind the same session wall it always has, and the sign-in round trip
   has to land somewhere: without these the redirect back from the identity
   provider would be handed to the app, which knows nothing about it. The list
   is deliberately tiny, and it is the same bargain the path form already makes
   by reserving /api and /app. */
const PLATFORM_PATHS = new Set(["/login", "/callback", "/logout", "/favicon.ico"]);

class AppHostMiddleware implements Middleware {

    constructor(private proxy : AppProxyHandler | undefined) {}

    async apply(request : Request) : Promise<boolean> {
        const appName = String(request.header(APP_HOST_HEADER) ?? "").trim();
        if (! this.proxy || ! appName) return true;
        if (PLATFORM_PATHS.has(request.url.pathname)) return true;

        await this.proxy.serveAtRoot(request, appName);
        return false;
    }

}

export { AppHostMiddleware, APP_HOST_HEADER };
