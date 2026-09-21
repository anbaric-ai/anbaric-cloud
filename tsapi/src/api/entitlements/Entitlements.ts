/* Whether a signed-in user holds a named entitlement for an app. An app declares
   its own entitlements with register (app-scoped); global entitlements are
   created in the console. A grant scoped to the checking app, or a global grant,
   both satisfy has. Granting is admin-only and lives on the platform. */
interface Entitlements {

    register(appId : string, entitlementId : string, notes? : string) : Promise<void>;

    has(appId : string, userId : string, entitlementId : string) : Promise<boolean>;

}

export type { Entitlements };
