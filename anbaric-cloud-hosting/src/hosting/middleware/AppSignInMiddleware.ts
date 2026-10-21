import {Authenticator} from "../../auth/Authenticator";
import {APP_HOST_HEADER} from "./AppHostMiddleware";
import {Middleware} from "../Middleware";
import {Request} from "../Request";

/* /login on an app's own hostname: a link a public app offers its members, so
   someone browsing anonymously can sign in and come back as themselves. Where
   to come back to is the page that linked here, read from the Referer and
   trusted only when it is on this same host and is a path rather than "//"
   and another host, so the link needs no parameter and cannot be made to
   send anyone elsewhere; failing that, the app's home.
   Someone already signed in goes straight back. */
class AppSignInMiddleware implements Middleware {

    constructor(private authenticator? : Authenticator) {}

    async apply(request : Request) : Promise<boolean> {
        if (! this.authenticator || request.method !== "GET" || request.url.pathname !== "/login") return true;
        if (! String(request.header(APP_HOST_HEADER) ?? "").trim()) return true;

        const returnTo = this.returnTo(request);
        const signingIn = Object.assign(Object.create(request.raw), { url: returnTo });
        const signedIn = await this.authenticator.authenticate(request.identity ?? request.session, signingIn, request.rawResponse);
        if (signedIn && ! request.handled) {
            request.rawResponse.writeHead(302, { location: returnTo });
            request.rawResponse.end();
        }
        return false;
    }

    private returnTo(request : Request) : string {
        try {
            const referrer = new URL(request.header("referer") ?? "");
            const onThisHost = referrer.host === request.header("host") && /^\/(?![\/\\])/.test(referrer.pathname);
            if (onThisHost && referrer.pathname !== "/login") return referrer.pathname + referrer.search;
        } catch {
        }
        return "/";
    }

}

export { AppSignInMiddleware }
