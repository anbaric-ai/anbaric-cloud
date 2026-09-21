import {EntitlementStore} from "../../data-store/EntitlementStore";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* The console-facing side, served on the authenticated public entry point:
   list definitions, create global ones, and grant or revoke entitlements to
   users. Grants record who made them from the signed-in user. */
class EntitlementsAdminHandler implements RequestHandler {

    constructor(private store : EntitlementStore) {}

    async handle(request : Request) : Promise<void> {
        const { method, id, subresource } = request;

        if (method === "GET" && ! id) return request.reply(200, await this.store.listDefinitions());
        if (method === "POST" && id === "definitions" && ! subresource) return this.defineGlobal(request);
        if (method === "GET" && id === "grants" && ! subresource) {
            return request.reply(200, await this.store.listGrants(request.query("userId")));
        }
        if (method === "POST" && id === "grants" && ! subresource) return this.grant(request);
        if (method === "DELETE" && id === "grants" && subresource) return this.revoke(request, subresource);
        request.notFound();
    }

    private async defineGlobal(request : Request) : Promise<void> {
        const body = await request.body() as { entitlementId? : string, notes? : string } | undefined;
        if (! body?.entitlementId) return request.reply(400, { error: "entitlementId is required" });

        await this.store.defineGlobal(body.entitlementId, body.notes ?? "");
        request.reply(204);
    }

    private async grant(request : Request) : Promise<void> {
        const body = await request.body() as
            { userId? : string, appId? : string | null, entitlementId? : string, notes? : string } | undefined;
        if (! body?.userId || ! body.entitlementId) {
            return request.reply(400, { error: "userId and entitlementId are required" });
        }

        const grantedBy = request.user?.id ?? "system";
        const grant = await this.store.grant(body.userId, body.appId || null, body.entitlementId, body.notes ?? "", grantedBy);
        request.reply(201, grant);
    }

    private async revoke(request : Request, grantId : string) : Promise<void> {
        const removed = await this.store.revoke(grantId);
        removed ? request.reply(204) : request.notFound();
    }

}

export { EntitlementsAdminHandler }
