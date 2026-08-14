import {KeyPair} from "./KeyPair";
import {Role} from "./Role";

class User {

    readonly id : string;
    roles : Array<Role>;
    keyPairs : Array<KeyPair>;

    constructor(id : string, roles : Array<Role> = [], keyPairs : Array<KeyPair> = []) {
        this.id = id;
        this.roles = roles;
        this.keyPairs = keyPairs;
    }

    hasRole(role : Role) : boolean {
        return this.roles.some(existing => existing.id === role.id);
    }

}

export { User }
