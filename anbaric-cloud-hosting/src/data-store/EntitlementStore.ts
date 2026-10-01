import {Entitlements} from "anbaric-tsapi";

/* An appId of null means global: a global definition is one no app owns
   (console-created), a global grant satisfies the check from any app. */
type EntitlementDefinition = {

    appId : string | null,
    entitlementId : string,
    notes : string,

};

type EntitlementGrant = {

    id : string,
    userId : string,
    appId : string | null,
    entitlementId : string,
    notes : string,
    grantedAt : string,
    grantedBy : string,

};

/* An entitlement chosen for somebody who has not signed in yet. An invitation
   names an email address; a grant names a user id, which that person does not
   have until they arrive. This is the gap between the two. */
type EntitlementOffer = {

    email : string,
    appId : string | null,
    entitlementId : string,
    notes : string,

};

/* The platform's view of entitlements: what apps can do (register, has) plus
   the management the console performs on their behalf. */
interface EntitlementStore extends Entitlements {

    defineGlobal(entitlementId : string, notes : string) : Promise<void>;

    listDefinitions() : Promise<Array<EntitlementDefinition>>;

    grant(userId : string, appId : string | null, entitlementId : string, notes : string, grantedBy : string) : Promise<EntitlementGrant>;

    revoke(grantId : string) : Promise<boolean>;

    listGrants(userId? : string) : Promise<Array<EntitlementGrant>>;

    // Held against an email address until whoever holds it signs in.
    offer(offers : Array<EntitlementOffer>, offeredBy : string) : Promise<void>;

    offersFor(email : string) : Promise<Array<EntitlementOffer>>;

    /* Turns everything offered to this email into real grants and forgets the
       offers. Returns how many were made, and is safe to call on every sign-in
       because the second call has nothing left to claim. */
    claim(email : string, userId : string) : Promise<number>;

}

export type { EntitlementStore, EntitlementDefinition, EntitlementGrant, EntitlementOffer }
