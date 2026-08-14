import {Role} from "./Role";
import {User} from "./User";

abstract class Authenticator {

    abstract authenticate(token : string) : Promise<User>;

    authorize(user : User, required : Role) : boolean {
        return user.hasRole(required);
    }

}

export { Authenticator }
