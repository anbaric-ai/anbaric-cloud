import {SESSION_COOKIE} from "../../auth/Authenticator";
import {Middleware} from "../Middleware";
import {Request} from "../Request";

class SessionMiddleware implements Middleware {

    async apply(request : Request) : Promise<boolean> {
        const cookies = String(request.header("cookie") ?? "").split(";");
        for (const cookie of cookies) {
            const [name, ...value] = cookie.trim().split("=");
            if (name === SESSION_COOKIE) {
                request.session = value.join("=");
                break;
            }
        }
        return true;
    }

}

export { SessionMiddleware }
