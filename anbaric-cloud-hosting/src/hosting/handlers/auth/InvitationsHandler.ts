import {MembershipService} from "../../../auth/MembershipService";
import {EntitlementOffer, EntitlementStore} from "../../../data-store/EntitlementStore";
import {canInvite, isTenantRole} from "../../../auth/TenantRole";
import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOST_USES = 1000;

/* The console's side of inviting people into this tenant: list what is
   pending, invite by email (attributed to the signed-in user), revoke.

   An invitation may also carry the app it should open on and the entitlements
   the inviter picked out for whoever accepts it. The two are kept apart on
   purpose: the landing app travels to the control plane, which owns the
   invitation and the addresses, while the entitlements stay here, because
   grants are the platform's and are held against the email address until
   that person first signs in. */
class InvitationsHandler implements RequestHandler {

    constructor(private memberships : MembershipService, private entitlements? : EntitlementStore) {}

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

    /* By email, or as a link. A link names nobody: whoever opens it and signs
       in joins, as many times as it allows, and the entitlements chosen for
       it are held against the link rather than an address. */
    private async invite(request : Request) : Promise<void> {
        const body = await request.body() as
            { email? : string, link? : unknown, uses? : unknown, role? : string, landingApp? : string, entitlements? : Array<unknown> } | undefined;
        const asLink = body?.link === true;
        const email = String(body?.email ?? "").trim();
        if (! asLink && ! EMAIL_SHAPE.test(email)) return request.reply(400, { error: "A valid email address is required" });

        const uses = asLink ? Number(body?.uses ?? 1) : 0;
        if (asLink && (! Number.isInteger(uses) || uses < 1 || uses > MOST_USES)) {
            return request.reply(400, { error: `A link may be used between 1 and ${MOST_USES} times` });
        }

        const role = body?.role ?? "USER";
        if (! isTenantRole(role) || role === "OWNER") {
            return request.reply(400, { error: "Invite someone as an ADMIN, BUILDER or USER" });
        }

        const landingApp = typeof body?.landingApp === "string" && body.landingApp.trim()
            ? body.landingApp.trim()
            : undefined;

        const invitation = asLink
            ? await this.memberships.inviteLink(role, this.asking(request), uses, landingApp)
            : await this.memberships.invite(email, role, this.asking(request), landingApp);

        /* Put aside after the invitation exists, so nothing is held for an
           email, or a link, that was never actually made. */
        const chosen = this.chosenEntitlements(body?.entitlements);
        if (chosen.length > 0 && this.entitlements) {
            if (asLink) {
                await this.entitlements.offerForLink(invitation.token, chosen, request.user?.id ?? "system");
            } else {
                await this.entitlements.offer(chosen.map(offer => ({ ...offer, email })), request.user?.id ?? "system");
            }
        }

        request.reply(201, { ...invitation, entitlements: chosen.length });
    }

    // Each is an app and an entitlement, with a null app meaning every app -
    // the same scoping a grant already has.
    private chosenEntitlements(chosen : Array<unknown> | undefined) : Array<Omit<EntitlementOffer, "email" | "linkToken">> {
        if (! Array.isArray(chosen)) return [];

        return chosen.flatMap(each => {
            const offer = each as { appId? : unknown, entitlementId? : unknown };
            if (typeof offer?.entitlementId !== "string" || ! offer.entitlementId) return [];

            return [{
                appId: typeof offer.appId === "string" && offer.appId ? offer.appId : null,
                entitlementId: offer.entitlementId,
                notes: "",
            }];
        });
    }

}

export { InvitationsHandler }
