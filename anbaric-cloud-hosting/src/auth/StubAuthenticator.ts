import {IncomingMessage, ServerResponse} from "node:http";
import {Authenticator} from "./Authenticator";
import {Tenant} from "./Tenant";
import {User} from "./User";

/* A development authenticator: every request is authenticated as a fixed
   user without any credential check, so the auth-dependent surface (whoami,
   keys, the dashboard) can be exercised with no identity provider. Never use
   it on a platform reachable by anyone you would not trust as that user. */
class StubAuthenticator extends Authenticator {

    constructor(private userId : string = process.env.ANBARIC_STUB_USER ?? "local-admin",
                private tenantId : string = process.env.ANBARIC_TENANT ?? "local") {
        super();
    }

    async authenticate(_session : string | undefined, _request : IncomingMessage,
                       _response : ServerResponse) : Promise<[User, Tenant] | undefined> {
        return [new User(this.userId), new Tenant(this.tenantId)];
    }

}

export { StubAuthenticator }
