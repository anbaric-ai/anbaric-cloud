import {MembershipService} from "../../../auth/MembershipService";
import {canInvite, isTenantRole} from "../../../auth/TenantRole";
import {EntitlementStore} from "../../../data-store/EntitlementStore";
import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

/* The console's side of administering who is in this tenant and as what:
   removing someone, and moving them between admin, builder and user.
   Membership is the control plane's - it is what admits a session at all -
   and it is asked to make each change; it also refuses the changes that are
   nobody's to make, such as the owner's role or your own.

   What is this platform's own is the entitlements a removed person held
   here, which go with them so nothing is left granted to somebody who can no
   longer sign in. Their directory entry stays: it is a record of who was here. */
class MembersHandler implements RequestHandler {

    constructor(private memberships : MembershipService, private entitlements? : EntitlementStore) {}

    async handle(request : Request) : Promise<void> {
        if (! request.id || request.subresource) return request.notFound();

        if (! canInvite(request.user?.tenantRole)) {
            return request.reply(403, { error: "Your role in this tenant cannot manage members" });
        }
        if (request.user?.id === request.id) {
            return request.reply(400, { error: "You cannot remove yourself or change your own role" });
        }

        if (request.method === "DELETE") return this.remove(request, request.id);
        if (request.method === "PATCH") return this.changeRole(request, request.id);
        request.notFound();
    }

    private asking(request : Request) {
        return request.user ? { id: request.user.id, name: request.user.name } : { id: "system" };
    }

    private async remove(request : Request, userId : string) : Promise<void> {
        let removed : boolean;
        try {
            removed = await this.memberships.remove(userId, this.asking(request));
        } catch (error) {
            return request.reply(403, { error: error instanceof Error ? error.message : "Could not remove that member" });
        }
        if (! removed) return request.notFound();

        for (const grant of await this.entitlements?.listGrants(userId) ?? []) {
            await this.entitlements?.revoke(grant.id);
        }
        request.reply(204);
    }

    private async changeRole(request : Request, userId : string) : Promise<void> {
        const body = await request.body() as { role? : unknown } | undefined;
        const role = body?.role;
        if (! isTenantRole(role) || role === "OWNER") {
            return request.reply(400, { error: "A member may be made an ADMIN, BUILDER or USER" });
        }

        let changed : string | undefined;
        try {
            changed = await this.memberships.changeRole(userId, role, this.asking(request));
        } catch (error) {
            return request.reply(403, { error: error instanceof Error ? error.message : "Could not change that role" });
        }
        if (! changed) return request.notFound();

        request.reply(200, { userId, role: changed });
    }

}

export { MembersHandler }
