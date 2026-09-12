import {KeyPair} from "./KeyPair";
import {Role} from "./Role";

class User {

    readonly id : string;
    roles : Array<Role>;
    keyPairs : Array<KeyPair>;
    readonly name? : string;
    readonly picture? : string;
    readonly email? : string;

    constructor(id : string, roles : Array<Role> = [], keyPairs : Array<KeyPair> = [],
                name? : string, picture? : string, email? : string) {
        this.id = id;
        this.roles = roles;
        this.keyPairs = keyPairs;
        this.name = name;
        this.picture = picture;
        this.email = email;
    }

    hasRole(role : Role) : boolean {
        return this.roles.some(existing => existing.id === role.id);
    }

}

export { User }
