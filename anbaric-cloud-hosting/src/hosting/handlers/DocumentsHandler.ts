import {JsonStore, SystemActor} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class DocumentsHandler implements RequestHandler {

    constructor(private storeFor : (appId : string, collection : string) => JsonStore) {}

    async handle(request : Request) : Promise<void> {
        if (!request.id) return request.notFound();

        // Documents are owned by the calling app (the ambient app header); the
        // store is scoped to (appId, collection) so ids never collide across apps.
        const store = this.storeFor(request.appId ?? "", request.id);
        if (request.subresource) return this.handleDocument(request, store, request.subresource);
        return this.handleCollection(request, store);
    }

    private async handleDocument(request : Request, store : JsonStore, documentId : string) : Promise<void> {
        switch (request.method) {
            case "PUT":
                await store.create(SystemActor.actor, documentId, await request.body());
                return request.reply(204);
            case "GET":
                return request.reply(200, await store.retrieve(documentId, SystemActor.actor));
            case "DELETE":
                await store.delete(documentId, SystemActor.actor);
                return request.reply(204);
        }
        request.notFound();
    }

    private async handleCollection(request : Request, store : JsonStore) : Promise<void> {
        switch (request.method) {
            case "GET": {
                const pageSize = Number(request.query("pageSize") ?? 100);
                const page = Number(request.query("page") ?? 0);
                return request.reply(200, await store.list(SystemActor.actor, pageSize, page));
            }
        }
        request.notFound();
    }

}

export { DocumentsHandler }
