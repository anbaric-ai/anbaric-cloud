import {UserDirectory} from "../../../auth/UserDirectory";
import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

class UsersHandler implements RequestHandler {

    constructor(private directory : UserDirectory) {}

    async handle(request : Request) : Promise<void> {
        if (request.method === "GET" && ! request.id) return request.reply(200, await this.directory.list());
        request.notFound();
    }

}

export { UsersHandler }
