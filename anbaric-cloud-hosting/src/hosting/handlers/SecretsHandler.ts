import {SecretStore, SystemActor} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class SecretsHandler implements RequestHandler {

    constructor(private storeFor : (appId : string) => SecretStore) {}

    async handle(request : Request) : Promise<void> {
        if (request.subresource) return request.notFound();
        // Secrets are owned by the calling app (the ambient app header).
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
