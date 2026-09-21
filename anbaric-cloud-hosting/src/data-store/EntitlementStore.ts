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

/* The platform's view of entitlements: what apps can do (register, has) plus
   the management the console performs on their behalf. */
interface EntitlementStore extends Entitlements {

    defineGlobal(entitlementId : string, notes : string) : Promise<void>;

    listDefinitions() : Promise<Array<EntitlementDefinition>>;

    grant(userId : string, appId : string | null, entitlementId : string, notes : string, grantedBy : string) : Promise<EntitlementGrant>;

    revoke(grantId : string) : Promise<boolean>;

    listGrants(userId? : string) : Promise<Array<EntitlementGrant>>;

}

export type { EntitlementStore, EntitlementDefinition, EntitlementGrant }
