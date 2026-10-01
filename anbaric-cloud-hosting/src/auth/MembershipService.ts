import {TenantRole} from "./TenantRole";

type PendingInvitation = {

    token : string,
    email : string,
    role : TenantRole,
    landingApp? : string,
    invitedBy : string,
    invitedByName? : string,
    link : string,
    createdAt : string,
    expiresAt : string,
    emailed? : boolean,

};

type Inviter = {

    id : string,
    name? : string,

};

/* Who belongs to this tenant and as what, and the invitations that get them
   here. Membership is decided wherever people sign in (Anbaric Cloud's central
   login), which owns the tenant definitions; a platform asks it who its caller
   is, and asks it to invite, list and revoke on the tenant's behalf. */
interface MembershipService {

    roleFor(userId : string) : Promise<TenantRole | undefined>;

    /* landingApp is the app the invitation should open on rather than the
       person's app directory. The control plane turns it into an address when
       the invitation is accepted, so a later change of address still works. */
    invite(email : string, role : TenantRole, invitedBy : Inviter, landingApp? : string) : Promise<PendingInvitation>;

    pending(asking : Inviter) : Promise<Array<PendingInvitation>>;

    revoke(token : string, asking : Inviter) : Promise<boolean>;

}

export type { MembershipService, PendingInvitation, Inviter }
