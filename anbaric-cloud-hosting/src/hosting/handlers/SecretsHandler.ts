import {SecretStore, SystemActor} from "anbaric-tsapi";
import {deniesBuild} from "../../auth/TenantRole";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* An app's secrets, owned by the app (the ambient app header). An app reads
   its own values; a person - at the console, at the CLI - may set, replace,
   list and delete them but never read one back, so a value that has reached
   the store is only ever seen again by the app it was set for. Managing them
   is a builder's job, where roles are in play. */
class SecretsHandler implements RequestHandler {

    constructor(private storeFor : (appId : string) => SecretStore) {}

    async handle(request : Request) : Promise<void> {
        if (request.subresource) return request.notFound();
        if (deniesBuild(request.user?.tenantRole)) {
            return request.reply(403, { error: "Your role in this tenant cannot manage secrets" });
        }
        const store = this.storeFor(request.appId ?? "");
        if (request.id) return this.handleSecret(request, store, request.id);
        return this.handleCollection(request, store);
    }

    private async handleSecret(request : Request, store : SecretStore, name : string) : Promise<void> {
        switch (request.method) {
            case "PUT": {
                const { value } = await request.body();
                if (typeof value !== "string") return request.reply(400, { error: "Expected a body of { value : string }" });
                await store.create(SystemActor.actor, name, value);
                return request.reply(204);
            }
            case "GET":
                if (request.user) {
                    return request.reply(403, { error: "A secret's value cannot be read back; set a new value instead" });
                }
                return request.reply(200, { value: await store.retrieve(name, SystemActor.actor) });
            case "DELETE":
                await store.delete(name, SystemActor.actor);
                return request.reply(204);
        }
        request.notFound();
    }

    private async handleCollection(request : Request, store : SecretStore) : Promise<void> {
        switch (request.method) {
            case "GET":
                return request.reply(200, await store.list(SystemActor.actor));
        }
        request.notFound();
    }

}

export { SecretsHandler }
