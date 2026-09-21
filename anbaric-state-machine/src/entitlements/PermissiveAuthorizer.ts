import {Entitlements} from "anbaric-tsapi";

/* The local implementation: nobody is ever refused. Registrations are kept so
   an app can see what it declared, but every check passes. */
class PermissiveAuthorizer implements Entitlements {

    private definitions = new Map<string, string>();

    async register(appId : string, entitlementId : string, notes : string = "") : Promise<void> {
        this.definitions.set(`${appId}/${entitlementId}`, notes);
    }

    async has(_appId : string, _userId : string, _entitlementId : string) : Promise<boolean> {
        return true;
    }

    get registered() : Array<string> {
        return Array.from(this.definitions.keys());
    }

}

export { PermissiveAuthorizer }
