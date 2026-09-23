import {randomUUID} from "node:crypto";
import {Inviter, MembershipService, PendingInvitation} from "./MembershipService";
import {canInvite, TenantRole} from "./TenantRole";

class InMemoryMembershipService implements MembershipService {

    private invitations = new Map<string, PendingInvitation>();
    private members = new Map<string, TenantRole>();

    constructor(private linkBase : string = "http://localhost/invitations") {}

    add(userId : string, role : TenantRole) : void {
        this.members.set(userId, role);
    }

    async roleFor(userId : string) : Promise<TenantRole | undefined> {
        return this.members.get(userId);
    }

    async invite(email : string, role : TenantRole, invitedBy : Inviter) : Promise<PendingInvitation> {
        const token = randomUUID();
        const now = new Date();
        const invitation : PendingInvitation = {
            token,
            email: email.trim().toLowerCase(),
            role,
            invitedBy: invitedBy.id,
            invitedByName: invitedBy.name,
            link: `${this.linkBase}/${token}`,
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            emailed: false,
        };
        this.invitations.set(token, invitation);
        return { ...invitation };
    }

    async pending(asking : Inviter) : Promise<Array<PendingInvitation>> {
        if (! canInvite(this.members.get(asking.id))) return [];
        return Array.from(this.invitations.values()).map(invitation => ({ ...invitation })).reverse();
    }

    async revoke(token : string, asking : Inviter) : Promise<boolean> {
        if (! canInvite(this.members.get(asking.id))) return false;
        return this.invitations.delete(token);
    }

}

export { InMemoryMembershipService }
