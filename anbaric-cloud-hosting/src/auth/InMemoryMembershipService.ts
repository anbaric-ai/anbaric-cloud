import {randomUUID} from "node:crypto";
import {Inviter, MembershipService, PendingInvitation} from "./MembershipService";

class InMemoryMembershipService implements MembershipService {

    private invitations = new Map<string, PendingInvitation>();

    constructor(private linkBase : string = "http://localhost/invitations") {}

    async invite(email : string, invitedBy : Inviter) : Promise<PendingInvitation> {
        const token = randomUUID();
        const now = new Date();
        const invitation : PendingInvitation = {
            token,
            email: email.trim().toLowerCase(),
            role: "member",
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

    async pending() : Promise<Array<PendingInvitation>> {
        return Array.from(this.invitations.values()).map(invitation => ({ ...invitation })).reverse();
    }

    async revoke(token : string) : Promise<boolean> {
        return this.invitations.delete(token);
    }

}

export { InMemoryMembershipService }
