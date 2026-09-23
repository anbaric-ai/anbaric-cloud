import {KeyPair} from "./KeyPair";
import {Role} from "./Role";
import {TenantRole} from "./TenantRole";

class User {

    readonly id : string;
    roles : Array<Role>;
    keyPairs : Array<KeyPair>;
    readonly name? : string;
    readonly picture? : string;
    readonly email? : string;
    // What this person may do in the tenant they are signed in to. Kept apart
    // from `roles`, which are the identity provider's and are what an app's own
    // authorization matches on - a platform capability is not a domain role.
    tenantRole? : TenantRole;

    constructor(id : string, roles : Array<Role> = [], keyPairs : Array<KeyPair> = [],
                name? : string, picture? : string, email? : string, tenantRole? : TenantRole) {
        this.id = id;
        this.roles = roles;
        this.keyPairs = keyPairs;
        this.name = name;
        this.picture = picture;
        this.email = email;
        this.tenantRole = tenantRole;
    }

    hasRole(role : Role) : boolean {
        return this.roles.some(existing => existing.id === role.id);
    }

}

export { User }
