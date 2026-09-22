import {MembershipService} from "../../../auth/MembershipService";
import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* The console's side of inviting people into this tenant: list what is
   pending, invite by email (attributed to the signed-in user), revoke. */
class InvitationsHandler implements RequestHandler {

    constructor(private memberships : MembershipService) {}

    async handle(request : Request) : Promise<void> {
        if (request.method === "GET" && ! request.id) return request.reply(200, await this.memberships.pending());
        if (request.method === "POST" && ! request.id) return this.invite(request);
        if (request.method === "DELETE" && request.id && ! request.subresource) {
            const revoked = await this.memberships.revoke(request.id);
            return revoked ? request.reply(204) : request.notFound();
        }
        request.notFound();
    }

    private async invite(request : Request) : Promise<void> {
        const body = await request.body() as { email? : string } | undefined;
        const email = String(body?.email ?? "").trim();
        if (! EMAIL_SHAPE.test(email)) return request.reply(400, { error: "A valid email address is required" });

        const inviter = request.user ? { id: request.user.id, name: request.user.name } : { id: "system" };
        request.reply(201, await this.memberships.invite(email, inviter));
    }

}

export { InvitationsHandler }
