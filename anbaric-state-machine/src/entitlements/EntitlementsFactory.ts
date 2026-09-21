import {Entitlements} from "anbaric-tsapi";
import {CloudEntitlements} from "anbaric-impl-cloud";
import {PermissiveAuthorizer} from "./PermissiveAuthorizer.js";

const EntitlementsFactory = {
    instance() : Entitlements {
        switch (process.env.ANBARIC_ENTITLEMENTS_TYPE) {
            case "cloud":
                return new CloudEntitlements();
            case "permissive":
            default:
                return new PermissiveAuthorizer();
        }
    }
}

export { EntitlementsFactory };
