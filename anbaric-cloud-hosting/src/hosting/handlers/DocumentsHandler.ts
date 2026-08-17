import {JsonStore} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class DocumentsHandler implements RequestHandler {

    constructor(private storeFor : (collection : string) => JsonStore) {}

    async handle(request : Request) : Promise<void> {
        if (!request.id) return request.notFound();

        const store = this.storeFor(request.id);
        if (request.subresource) return this.handleDocument(request, store, request.subresource);
        return this.handleCollection(request, store);
    }

    private async handleDocument(request : Request, store : JsonStore, documentId : string) : Promise<void> {
        switch (request.method) {
            case "PUT":
                await store.save(documentId, await request.body());
                return request.reply(204);
            case "GET":
                return request.reply(200, await store.retrieve(documentId));
            case "DELETE":
                await store.delete(documentId);
                return request.reply(204);
        }
        request.notFound();
    }

    private async handleCollection(request : Request, store : JsonStore) : Promise<void> {
        switch (request.method) {
            case "GET": {
                const pageSize = Number(request.query("pageSize") ?? 100);
                const page = Number(request.query("page") ?? 0);
                return request.reply(200, await store.list(pageSize, page));
            }
        }
        request.notFound();
    }

}

export { DocumentsHandler }
