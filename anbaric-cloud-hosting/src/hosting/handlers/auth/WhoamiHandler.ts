import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

/* Who is signed in, and which tenant this platform is - the platform's own
   tenant when it has one, else the tenant the session names. */
class WhoamiHandler implements RequestHandler {

    constructor(private tenant? : string) {}

    async handle(request : Request) : Promise<void> {
        if (request.method === "GET" && !request.id && request.user) {
            return request.reply(200, {
                id: request.user.id,
                roles: request.user.roles.map(role => role.id),
                name: request.user.name,
                picture: request.user.picture,
                tenantRole: request.user.tenantRole,
                tenant: this.tenant ?? request.tenant?.id,
            });
        }
        request.notFound();
    }

}

export { WhoamiHandler }
