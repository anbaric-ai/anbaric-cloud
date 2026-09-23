import {CliAuthorizer} from "../../../auth/CliAuthorizer";
import {User} from "../../../auth/User";
import {deniesBuild} from "../../../auth/TenantRole";
import {Request} from "../../Request";
import {RequestHandler} from "../../RequestHandler";
import {PagesHandler} from "../PagesHandler";

class AuthorizeCliHandler implements RequestHandler {

    constructor(private authorizer : CliAuthorizer, private pages : PagesHandler,
                private tenant? : string) {}

    async handle(request : Request) : Promise<void> {
        const requestId = request.id;
        if (!requestId) return request.notFound();

        switch (request.subresource) {
            case "poll":
                if (request.method === "GET") return this.handlePoll(request, requestId);
                break;
            case undefined:
                switch (request.method) {
                    case "GET":
                        return this.pages.serve(request);
                    case "POST":
                        return this.handleApprove(request, requestId);
                }
                break;
        }
        request.notFound();
    }

    private async handlePoll(request : Request, requestId : string) : Promise<void> {
        const keyPair = this.authorizer.collect(requestId);
        if (!keyPair) return request.reply(202, { status: "pending" });
        request.reply(200, keyPair);
    }

    private async handleApprove(request : Request, requestId : string) : Promise<void> {
        const { clientName } = await request.body();
        if (typeof clientName !== "string" || clientName.trim().length === 0) {
            return request.reply(400, { error: "Expected a body of { clientName : string }" });
        }
        // A key deploys as its owner, so only someone who may deploy may mint one.
        if (deniesBuild(request.user?.tenantRole)) {
            return request.reply(403, { error: "Your role in this tenant cannot create keys" });
        }

        // The tenant is this platform's own: what it is deployed as, which is
        // the slug the edge routes on and the CLI is later checked against.
        await this.authorizer.approve(requestId, clientName.trim(), request.user ?? new User("local"),
            this.tenant ?? request.tenant?.id);
        request.reply(204);
    }

}

export { AuthorizeCliHandler }
