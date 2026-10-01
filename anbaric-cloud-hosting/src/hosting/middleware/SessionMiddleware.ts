import {IDENTITY_COOKIE, SESSION_COOKIE} from "../../auth/Authenticator";
import {Middleware} from "../Middleware";
import {Request} from "../Request";

/* Lifts the two cookies authentication cares about off the request: this
   platform's own session, and the identity the central login proved. The
   first of each name wins, which is what a browser sends first. */
class SessionMiddleware implements Middleware {

    async apply(request : Request) : Promise<boolean> {
        const cookies = String(request.header("cookie") ?? "").split(";");
        for (const cookie of cookies) {
            const [name, ...value] = cookie.trim().split("=");
            if (name === SESSION_COOKIE && request.session === undefined) request.session = value.join("=");
            if (name === IDENTITY_COOKIE && request.identity === undefined) request.identity = value.join("=");
        }
        return true;
    }

}

export { SessionMiddleware }
