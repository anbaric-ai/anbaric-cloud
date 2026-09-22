import {PromptManager} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* Prompts belong to the calling app (the ambient app header): save a version,
   fetch the latest or a named one, list, and read a prompt's history. */
class PromptsHandler implements RequestHandler {

    constructor(private managerFor : (appId : string) => PromptManager) {}

    async handle(request : Request) : Promise<void> {
        const appId = request.appId;
        if (! appId) return request.reply(400, { error: "Missing the x-anbaric-app header" });

        const manager = this.managerFor(appId);
        const { method, id, subresource } = request;

        if (method === "GET" && ! id) return request.reply(200, await manager.list());
        if (method === "PUT" && id && ! subresource) return this.save(request, manager, id);
        if (method === "GET" && id && ! subresource) return this.retrieve(request, manager, id);
        if (method === "GET" && id && subresource === "history") return request.reply(200, await manager.history(id));
        request.notFound();
    }

    private async save(request : Request, manager : PromptManager, promptId : string) : Promise<void> {
        const body = await request.body() as { instructions? : string, inputSchema? : object, outputSchema? : object } | undefined;
        if (typeof body?.instructions !== "string") return request.reply(400, { error: "instructions is required" });

        request.reply(200, await manager.save(promptId, body.instructions, body.inputSchema, body.outputSchema));
    }

    private async retrieve(request : Request, manager : PromptManager, promptId : string) : Promise<void> {
        const raw = request.query("version");
        const version = raw === undefined ? undefined : Number(raw);
        if (version !== undefined && ! Number.isInteger(version)) return request.reply(400, { error: `"${raw}" is not a version` });

        try {
            request.reply(200, await manager.retrieve(promptId, version));
        } catch (error) {
            request.reply(404, { error: error instanceof Error ? error.message : String(error) });
        }
    }

}

export { PromptsHandler }
