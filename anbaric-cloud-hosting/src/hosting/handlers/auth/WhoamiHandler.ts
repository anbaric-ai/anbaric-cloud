import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";

/* Who is signed in, and which tenant this platform is - the platform's own
   tenant when it has one, else the tenant the session names.

   appHostSuffix is the domain under which each app has a hostname of its own,
   and it is told rather than guessed: the console cannot know whether wildcard
   DNS exists for wherever it happens to be served from, and a self-hosted
   install usually has none. Absent, the console links to apps by path. */
class WhoamiHandler implements RequestHandler {

    constructor(private tenant? : string,
                private appHostSuffix : string = process.env.ANBARIC_APP_HOST_SUFFIX ?? "") {}

    async handle(request : Request) : Promise<void> {
        if (request.method === "GET" && !request.id && request.user) {
            return request.reply(200, {
                id: request.user.id,
                roles: request.user.roles.map(role => role.id),
                name: request.user.name,
                picture: request.user.picture,
                tenantRole: request.user.tenantRole,
                tenant: this.tenant ?? request.tenant?.id,
                appHostSuffix: this.appHostSuffix || undefined,
            });
        }
        request.notFound();
    }

}

export { WhoamiHandler }
