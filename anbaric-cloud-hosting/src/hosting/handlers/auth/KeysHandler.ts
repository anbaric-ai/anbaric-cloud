import {CliAuthorizer} from "../../../auth/CliAuthorizer";
import {User} from "../../../auth/User";
import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

class KeysHandler implements RequestHandler {

    constructor(private authorizer : CliAuthorizer) {}

    async handle(request : Request) : Promise<void> {
        const owner = request.user ?? new User("local");

        if (request.id) {
            switch (request.method) {
                case "DELETE":
                    await this.authorizer.revoke(request.id, owner.id);
                    return request.reply(204);
            }
        } else {
            switch (request.method) {
                case "GET": {
                    const keys = await this.authorizer.keysFor(owner.id);
                    return request.reply(200, keys.map(key => ({
                        id: key.id,
                        clientName: key.clientName,
                        createdAt: key.createdAt.toISOString(),
                    })));
                }
            }
        }
        request.notFound();
    }

}

export { KeysHandler }
