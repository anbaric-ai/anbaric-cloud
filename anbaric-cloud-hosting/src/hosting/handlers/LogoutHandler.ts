import {Authenticator, IDENTITY_COOKIE} from "../../auth/Authenticator";
import {SessionSigner} from "../../auth/SessionSigner";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

const TENANT_COOKIE = "anbaric_tenant";

/* Ends the platform session. Every cookie that could sign the person back in
   or route them somewhere goes: the platform's own session, the identity the
   central login left, and the tenant the edge was routing them to - both the
   domain-scoped cookie and any host-only one from before the domain was set,
   because a browser keeps the one whose attributes you did not match. Where
   the browser goes next is the authenticator's business, because an identity
   provider holding its own session has to be signed out of as well - otherwise
   the redirect home just signs the person straight back in. */
class LogoutHandler implements RequestHandler {

    constructor(private authenticator? : Authenticator,
                private sessionSigner : SessionSigner = new SessionSigner(),
                private domain : string | undefined = process.env.ANBARIC_COOKIE_DOMAIN || undefined) {}

    async handle(request : Request) : Promise<void> {
        this.sessionSigner.clear(request.rawResponse);

        const expired = [IDENTITY_COOKIE, TENANT_COOKIE].flatMap(name => [
            `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
            ...(this.domain ? [`${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Domain=${this.domain}`] : []),
        ]);
        const existing = request.rawResponse.getHeader("Set-Cookie");
        const before = existing === undefined ? [] : Array.isArray(existing) ? existing : [String(existing)];
        request.rawResponse.setHeader("Set-Cookie", [...before, ...expired]);

        request.redirect(this.authenticator?.logoutUrl() ?? "/");
    }

}

export { LogoutHandler }
