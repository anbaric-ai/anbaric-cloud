import {MembershipService} from "../../../auth/MembershipService";
import {canInvite, isTenantRole} from "../../../auth/TenantRole";
import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* The console's side of inviting people into this tenant: list what is
   pending, invite by email (attributed to the signed-in user), revoke. */
class InvitationsHandler implements RequestHandler {

    constructor(private memberships : MembershipService) {}

    async handle(request : Request) : Promise<void> {
        // Only a tenant's owner or admin administers its membership. Central
        // checks this too - it is the authority - but refusing here keeps the
        // console honest and gives a clear answer without a round trip.
        if (! canInvite(request.user?.tenantRole)) {
            return request.reply(403, { error: "Your role in this tenant cannot manage members" });
        }

        const asking = this.asking(request);
        if (request.method === "GET" && ! request.id) return request.reply(200, await this.memberships.pending(asking));
        if (request.method === "POST" && ! request.id) return this.invite(request);
        if (request.method === "DELETE" && request.id && ! request.subresource) {
            const revoked = await this.memberships.revoke(request.id, asking);
            return revoked ? request.reply(204) : request.notFound();
        }
        request.notFound();
    }

    private asking(request : Request) {
        return request.user ? { id: request.user.id, name: request.user.name } : { id: "system" };
    }

    private async invite(request : Request) : Promise<void> {
        const body = await request.body() as { email? : string, role? : string } | undefined;
        const email = String(body?.email ?? "").trim();
        if (! EMAIL_SHAPE.test(email)) return request.reply(400, { error: "A valid email address is required" });

        const role = body?.role ?? "USER";
        if (! isTenantRole(role) || role === "OWNER") {
            return request.reply(400, { error: "Invite someone as an ADMIN, BUILDER or USER" });
        }

        request.reply(201, await this.memberships.invite(email, role, this.asking(request)));
    }

}

export { InvitationsHandler }
