import {IncomingMessage, ServerResponse} from "node:http";
import {Tenant} from "./Tenant";
import {User} from "./User";

const SESSION_COOKIE = "anbaric_session";

/* The identity cookie: who this person is, as the central login proved it,
   set for the whole domain and never overwritten by a tenant platform. A
   platform's own session cookie is bound to that platform - signed with its
   secret - so moving between tenants invalidates it every time; this one is
   bound to the person, and is what a platform falls back to before sending
   anyone through the login again. Mirrors CENTRAL_SESSION_COOKIE in
   anbaric-cloud-central; keep the two in step. */
const IDENTITY_COOKIE = "anbaric_central_session";

abstract class Authenticator {

    abstract authenticate(session : string | undefined, request : IncomingMessage,
                          response : ServerResponse) : Promise<[User, Tenant] | undefined>;

    /* Who a session belongs to, without sending anyone to a login when it
       proves nothing: a public app serves the person it can recognise and
       anyone else anonymously. An authenticator that cannot tell quietly
       recognises no one. */
    async identify(_session : string | undefined, _request : IncomingMessage) : Promise<[User, Tenant] | undefined> {
        return undefined;
    }

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

export { Authenticator, SESSION_COOKIE, IDENTITY_COOKIE }
