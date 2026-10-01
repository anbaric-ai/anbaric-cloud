import {MembershipService} from "../../../auth/MembershipService";
import {canInvite} from "../../../auth/TenantRole";
import {EntitlementStore} from "../../../data-store/EntitlementStore";
import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

/* The console's side of removing someone from this tenant. Membership is the
   control plane's to end - it is what admits a session at all - and it is
   asked to; what is this platform's own is the entitlements that person held
   here, which go with them so nothing is left granted to somebody who can no
   longer sign in. Their directory entry stays: it is a record of who was here. */
class MembersHandler implements RequestHandler {

    constructor(private memberships : MembershipService, private entitlements? : EntitlementStore) {}

    async handle(request : Request) : Promise<void> {
        if (request.method !== "DELETE" || ! request.id || request.subresource) return request.notFound();

        if (! canInvite(request.user?.tenantRole)) {
            return request.reply(403, { error: "Your role in this tenant cannot remove members" });
        }
        if (request.user?.id === request.id) {
            return request.reply(400, { error: "You cannot remove yourself from a tenant" });
        }

        const asking = request.user ? { id: request.user.id, name: request.user.name } : { id: "system" };
        let removed : boolean;
        try {
            removed = await this.memberships.remove(request.id, asking);
        } catch (error) {
            return request.reply(403, { error: error instanceof Error ? error.message : "Could not remove that member" });
        }
        if (! removed) return request.notFound();

        for (const grant of await this.entitlements?.listGrants(request.id) ?? []) {
            await this.entitlements?.revoke(grant.id);
        }
        request.reply(204);
    }

}

export { MembersHandler }
