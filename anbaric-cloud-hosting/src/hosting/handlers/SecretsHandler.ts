import {SecretStore, SystemActor} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class SecretsHandler implements RequestHandler {

    constructor(private secretStore : SecretStore) {}

    async handle(request : Request) : Promise<void> {
        if (request.subresource) return request.notFound();
        if (request.id) return this.handleSecret(request, request.id);
        return this.handleCollection(request);
    }

    private async handleSecret(request : Request, name : string) : Promise<void> {
        switch (request.method) {
            case "PUT": {
                const { value } = await request.body();
                if (typeof value !== "string") return request.reply(400, { error: "Expected a body of { value : string }" });
                await this.secretStore.create(SystemActor.actor, name, value);
                return request.reply(204);
            }
            case "GET":
                return request.reply(200, { value: await this.secretStore.retrieve(name, SystemActor.actor) });
            case "DELETE":
                await this.secretStore.delete(name, SystemActor.actor);
                return request.reply(204);
        }
        request.notFound();
    }

    private async handleCollection(request : Request) : Promise<void> {
        switch (request.method) {
            case "GET":
                return request.reply(200, await this.secretStore.list(SystemActor.actor));
        }
        request.notFound();
    }

}

export { SecretsHandler }
