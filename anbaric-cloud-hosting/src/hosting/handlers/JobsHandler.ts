import {JobPersistence, deserializeJob, serializeJob} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class JobsHandler implements RequestHandler {

    constructor(private persistence : JobPersistence) {}

    async handle(request : Request) : Promise<void> {
        switch (request.subresource) {
            case "properties":
                if (request.id) return this.handleProperties(request, request.id);
                break;
            case undefined:
                if (request.id) return this.handleJob(request, request.id);
                return this.handleCollection(request);
        }
        request.notFound();
    }

    private async handleProperties(request : Request, id : string) : Promise<void> {
        switch (request.method) {
            case "PATCH": {
                const properties = new Map<string, any>(Object.entries(await request.body()));
                await this.persistence.updateProperties(id, properties);
                return request.reply(204);
            }
        }
        request.notFound();
    }

    private async handleJob(request : Request, id : string) : Promise<void> {
        switch (request.method) {
            case "PUT":
                await this.persistence.save(deserializeJob(await request.body()));
                return request.reply(204);
            case "GET":
                return request.reply(200, serializeJob(await this.persistence.retrieve(id)));
            case "DELETE":
                await this.persistence.delete(id);
                return request.reply(204);
        }
        request.notFound();
    }

    private async handleCollection(request : Request) : Promise<void> {
        switch (request.method) {
            case "GET": {
                const pageSize = Number(request.query("pageSize") ?? 100);
                const page = Number(request.query("page") ?? 0);
                const jobs = await this.persistence.list(pageSize, page);
                return request.reply(200, jobs.map(serializeJob));
            }
        }
        request.notFound();
    }

}

export { JobsHandler }
