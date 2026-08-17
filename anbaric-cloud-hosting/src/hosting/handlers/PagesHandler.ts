import {readFile} from "node:fs/promises";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class PagesHandler implements RequestHandler {

    async handle(request : Request) : Promise<void> {
        if (request.method === "GET" && !request.id) return this.serve(request);
        request.notFound();
    }

    async serve(request : Request) : Promise<void> {
        try {
            request.replyHtml(await readFile(new URL("../pages/platform-ui.html", import.meta.url)));
        } catch {
            request.reply(501, { error: "The platform UI has not been built - run npm run build in anbaric-cloud-hosting/ui" });
        }
    }

}

export { PagesHandler }
