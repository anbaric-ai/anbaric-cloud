import {readFile} from "node:fs/promises";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

const CACHE_SECONDS = 86_400;

/* Serves the Anbaric ident at /favicon.ico for everything the platform fronts.
   The admin console asks for it explicitly; a deployed app served under
   /app/<name> gets it for free, because a browser falls back to the origin root
   when the app's own pages declare no icon. */
class FaviconHandler implements RequestHandler {

    private icon? : Buffer;

    async handle(request : Request) : Promise<void> {
        if (request.method !== "GET") return request.notFound();

        try {
            request.replyImage(await this.load(), "image/png", CACHE_SECONDS);
        } catch {
            request.notFound();
        }
    }

    private async load() : Promise<Buffer> {
        if (!this.icon) this.icon = await readFile(new URL("../pages/anbaric-favicon.png", import.meta.url));
        return this.icon;
    }

}

export { FaviconHandler }
