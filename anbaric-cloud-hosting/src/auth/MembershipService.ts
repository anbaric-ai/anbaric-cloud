type PendingInvitation = {

    token : string,
    email : string,
    role : string,
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

/* Invitations into this tenant. Membership itself is decided wherever people
   sign in (Anbaric Cloud's central login), so a platform only asks that
   service to invite, list and revoke on the tenant's behalf. */
interface MembershipService {

    invite(email : string, invitedBy : Inviter) : Promise<PendingInvitation>;

    pending() : Promise<Array<PendingInvitation>>;

    revoke(token : string) : Promise<boolean>;

}

export type { MembershipService, PendingInvitation, Inviter }
