import {SessionSigner} from "../../../auth/SessionSigner";
import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

/* Resolves a platform session token into the user's identity, for apps that
   cannot verify it themselves (the signing secret is platform only). The token
   travels in the body - it is the credential - so this needs no session
   middleware and is safe on the internal, app-facing router. */
class SessionsHandler implements RequestHandler {

    constructor(private sessionSigner : SessionSigner = new SessionSigner()) {}

    async handle(request : Request) : Promise<void> {
        if (request.method === "POST" && request.id === "resolve" && !request.subresource) {
            return this.resolve(request);
        }
        request.notFound();
    }

    private async resolve(request : Request) : Promise<void> {
        const body = await request.body() as { session? : string } | undefined;
        const resolved = this.sessionSigner.verify(body?.session);
        if (!resolved) return request.reply(401, { error: "Invalid or expired session" });

        const [user, tenant] = resolved;
        request.reply(200, {
            id: user.id,
            roles: user.roles.map(role => role.id),
            tenant: tenant?.id,
        });
    }

}

export { SessionsHandler }
