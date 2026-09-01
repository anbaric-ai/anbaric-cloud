import {Authenticator} from "../../auth/Authenticator";
import {SessionSigner} from "../../auth/SessionSigner";
import {TokenAuthenticator} from "../../auth/TokenAuthenticator";
import {Middleware} from "../Middleware";
import {Request} from "../Request";

type OpenRequestPredicate = (request : Request) => boolean;

/* Decorates the request with its authenticated user and tenant - bearer
   tokens first, then a valid platform session cookie, then the authenticator -
   and enforces authorization. A valid platform session short-circuits the
   authenticator entirely (no identity-provider round-trip) and slides its
   expiry; a fresh authenticator login mints one. Requests matching the open
   predicate (ping, the one-time CLI key poll) pass through untouched, as does
   everything when no authenticator is configured. */
class AuthenticationMiddleware implements Middleware {

    constructor(private authenticator? : Authenticator,
                private tokenAuthenticator? : TokenAuthenticator,
                private isOpen : OpenRequestPredicate = () => false,
                private sessionSigner : SessionSigner = new SessionSigner()) {}

    async apply(request : Request) : Promise<boolean> {
        if (this.isOpen(request)) return true;

        if (this.tokenAuthenticator?.handles(request.raw)) {
            const user = await this.tokenAuthenticator.authenticate(request.raw, request.rawResponse);
            if (!user) return false;
            request.user = user;
            return this.authorized(request);
        }

        if (this.sessionSigner.configured) {
            const session = this.sessionSigner.verify(request.session);
            if (session) {
                [request.user, request.tenant] = session;
                this.sessionSigner.issue(request.rawResponse, request.user!, request.tenant);
                return this.authorized(request);
            }
        }

        // A state-changing request with no valid session, bound for an
        // authenticator that redirects to an interactive login, would have its
        // body silently discarded across that redirect. Fail it loudly instead
        // so the client can re-authenticate (a fresh GET) and retry.
        if (this.isStateChanging(request.method) && this.authenticator?.redirectsToLoginOnFailure() && !request.handled) {
            request.reply(401, { error: "Your session has expired or you are not signed in. Reload the page and try again." });
            return false;
        }

        if (!this.authenticator) return true;

        const authenticated = await this.authenticator.authenticate(request.session, request.raw, request.rawResponse);
        if (!authenticated) return false;

        [request.user, request.tenant] = authenticated;
        if (this.sessionSigner.configured && !request.handled) {
            this.sessionSigner.issue(request.rawResponse, request.user!, request.tenant);
        }
        return this.authorized(request);
    }

    private isStateChanging(method : string) : boolean {
        return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
    }

    private async authorized(request : Request) : Promise<boolean> {
        if (!this.authenticator || !request.user) return true;

        const permitted = await this.authenticator.authorize(request.user, request.raw, request.rawResponse);
        if (!permitted) {
            if (!request.handled) request.reply(403, { error: "Not authorized" });
            return false;
        }
        return true;
    }

}

export { AuthenticationMiddleware };
export type { OpenRequestPredicate };
