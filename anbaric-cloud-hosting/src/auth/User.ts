import {KeyPair} from "./KeyPair";
import {Role} from "./Role";

class User {

    readonly id : string;
    roles : Array<Role>;
    keyPairs : Array<KeyPair>;
    readonly name? : string;
    readonly picture? : string;

    constructor(id : string, roles : Array<Role> = [], keyPairs : Array<KeyPair> = [],
                name? : string, picture? : string) {
        this.id = id;
        this.roles = roles;
        this.keyPairs = keyPairs;
        this.name = name;
        this.picture = picture;
    }

    hasRole(role : Role) : boolean {
        return this.roles.some(existing => existing.id === role.id);
    }

}

export { User }
