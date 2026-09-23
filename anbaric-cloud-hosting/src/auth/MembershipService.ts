import {TenantRole} from "./TenantRole";

type PendingInvitation = {

    token : string,
    email : string,
    role : TenantRole,
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

    invite(email : string, role : TenantRole, invitedBy : Inviter) : Promise<PendingInvitation>;

    pending(asking : Inviter) : Promise<Array<PendingInvitation>>;

    revoke(token : string, asking : Inviter) : Promise<boolean>;

}

export type { MembershipService, PendingInvitation, Inviter }
