import {IncomingMessage, ServerResponse} from "node:http";
import {Tenant} from "./Tenant";
import {User} from "./User";

const SESSION_COOKIE = "anbaric_session";

abstract class Authenticator {

    abstract authenticate(session : string | undefined, request : IncomingMessage,
                          response : ServerResponse) : Promise<[User, Tenant] | undefined>;

    async authorize(_user : User, _request : IncomingMessage, _response : ServerResponse) : Promise<boolean> {
        return true;
    }

    // True for authenticators that answer an unauthenticated request with a
    // redirect to an interactive login (an identity provider). The platform
    // uses this to avoid discarding the body of a state-changing request that
    // hits an expired session - it fails such a request cleanly instead.
    redirectsToLoginOnFailure() : boolean {
        return false;
    }

    // Where to send someone once their platform session has been cleared. An
    // identity provider that keeps a session of its own should return its
    // logout URL, or signing out would silently sign them straight back in.
    logoutUrl() : string | undefined {
        return undefined;
    }

}

export { Authenticator, SESSION_COOKIE }
