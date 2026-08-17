import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

class WhoamiHandler implements RequestHandler {

    async handle(request : Request) : Promise<void> {
        if (request.method === "GET" && !request.id && request.user) {
            return request.reply(200, {
                id: request.user.id,
                roles: request.user.roles.map(role => role.id),
            });
        }
        request.notFound();
    }

}

export { WhoamiHandler }
