import {Authenticator} from "../../auth/Authenticator";
import {TokenAuthenticator} from "../../auth/TokenAuthenticator";
import {Middleware} from "../Middleware";
import {Request} from "../Request";

type OpenRequestPredicate = (request : Request) => boolean;

/* Decorates the request with its authenticated user and tenant - bearer
   tokens first, sessions otherwise - and enforces authorization. Requests
   matching the open predicate (ping, the one-time CLI key poll) pass
   through untouched, as does everything when no authenticator is
   configured. */
class AuthenticationMiddleware implements Middleware {

    constructor(private authenticator? : Authenticator,
                private tokenAuthenticator? : TokenAuthenticator,
                private isOpen : OpenRequestPredicate = () => false) {}

    async apply(request : Request) : Promise<boolean> {
        if (this.isOpen(request)) return true;

        if (this.tokenAuthenticator?.handles(request.raw)) {
            const user = await this.tokenAuthenticator.authenticate(request.raw, request.rawResponse);
            if (!user) return false;
            request.user = user;
            return this.authorized(request);
        }

        if (!this.authenticator) return true;

        const authenticated = await this.authenticator.authenticate(request.session, request.raw, request.rawResponse);
        if (!authenticated) return false;

        [request.user, request.tenant] = authenticated;
        return this.authorized(request);
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
