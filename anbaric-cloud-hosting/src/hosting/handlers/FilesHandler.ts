import {FileStorage, SystemActor} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

const PAGE_SIZE = 20;

/* Serves an app's files. The item lives at /files/item?path=... because a
   file path carries slashes of its own, which the router would otherwise read
   as resource segments. The collection at /files?prefix= is paged for the
   console; a client asking for all=true gets the lot, since that is what a
   list call means to an app. */
class FilesHandler implements RequestHandler {

    constructor(private storeFor : (appId : string) => FileStorage) {}

    async handle(request : Request) : Promise<void> {
        if (request.subresource) return request.notFound();
        // Files are owned by the calling app (the ambient app header).
        const store = this.storeFor(request.appId ?? "");
        if (request.id === "item") return this.handleItem(request, store);
        if (request.id) return request.notFound();
        return this.handleCollection(request, store);
    }

    private async handleItem(request : Request, store : FileStorage) : Promise<void> {
        const path = request.query("path") ?? "";
        if (! path) return request.reply(400, { error: "Expected a ?path query parameter" });

        switch (request.method) {
            case "PUT": {
                const contents = await request.rawBody();
                await store.put(SystemActor.actor, path, contents, request.header("content-type") ?? "application/octet-stream");
                return request.reply(204);
            }
            case "GET": {
                const file = await store.get(path, SystemActor.actor);
                return request.replyBytes(Buffer.from(file.contents), file.contentType, {
                    "last-modified": file.lastModified.toUTCString(),
                });
            }
            case "DELETE":
                await store.delete(path, SystemActor.actor);
                return request.reply(204);
        }
        request.notFound();
    }

    private async handleCollection(request : Request, store : FileStorage) : Promise<void> {
        if (request.method !== "GET") return request.notFound();

        const all = await store.list(request.query("prefix") ?? "", SystemActor.actor);
        if (request.query("all") === "true") return request.reply(200, { files: all, total: all.length, pageSize: all.length });

        const page = Math.max(0, Math.trunc(Number(request.query("page"))) || 0);
        const files = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        request.reply(200, { files, total: all.length, pageSize: PAGE_SIZE });
    }

}

export { FilesHandler, PAGE_SIZE }
