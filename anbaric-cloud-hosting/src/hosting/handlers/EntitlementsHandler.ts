import {Entitlements} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* The app-facing side, served on the internal entry point: register an
   entitlement and check whether a user holds it. Both are scoped to the
   calling app (the ambient app header), so an app can neither define a global
   entitlement nor check as another app. */
class EntitlementsHandler implements RequestHandler {

    constructor(private entitlements : Entitlements) {}

    async handle(request : Request) : Promise<void> {
        const appId = request.appId;
        if (! appId) return request.reply(400, { error: "Missing the x-anbaric-app header" });

        if (request.method === "POST" && ! request.id) return this.register(request, appId);
        if (request.method === "GET" && request.id && request.subresource === "check") return this.check(request, appId);
        request.notFound();
    }

    private async register(request : Request, appId : string) : Promise<void> {
        const body = await request.body() as { entitlementId? : string, notes? : string } | undefined;
        if (! body?.entitlementId) return request.reply(400, { error: "entitlementId is required" });

        await this.entitlements.register(appId, body.entitlementId, body.notes ?? "");
        request.reply(204);
    }

    private async check(request : Request, appId : string) : Promise<void> {
        const userId = request.query("userId");
        if (! userId) return request.reply(400, { error: "userId is required" });

        request.reply(200, { has: await this.entitlements.has(appId, userId, request.id!) });
    }

}

export { EntitlementsHandler }
