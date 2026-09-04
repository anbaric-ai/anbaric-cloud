import {Authenticator} from "../../auth/Authenticator";
import {SessionSigner} from "../../auth/SessionSigner";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* Ends the platform session. The cookie is cleared here; where the browser
   goes next is the authenticator's business, because an identity provider
   holding its own session has to be signed out of as well - otherwise the
   redirect home just signs the person straight back in. */
class LogoutHandler implements RequestHandler {

    constructor(private authenticator? : Authenticator) {}

    async handle(request : Request) : Promise<void> {
        SessionSigner.clear(request.rawResponse);
        request.redirect(this.authenticator?.logoutUrl() ?? "/");
    }

}

export { LogoutHandler }
