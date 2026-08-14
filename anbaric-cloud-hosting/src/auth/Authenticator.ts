import {IncomingMessage, ServerResponse} from "node:http";
import {User} from "./User";

const SESSION_COOKIE = "anbaric_session";

abstract class Authenticator {

    abstract authenticate(session : string | undefined, request : IncomingMessage,
                          response : ServerResponse) : Promise<User | undefined>;

    async authorize(_user : User, _request : IncomingMessage, _response : ServerResponse) : Promise<boolean> {
        return true;
    }

}

export { Authenticator, SESSION_COOKIE }
