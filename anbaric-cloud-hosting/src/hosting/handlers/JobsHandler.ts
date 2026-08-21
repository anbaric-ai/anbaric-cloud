import {JobPersistence, SystemActor, deserializeJob, serializeJob} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class JobsHandler implements RequestHandler {

    constructor(private persistence : JobPersistence) {}

    async handle(request : Request) : Promise<void> {
        if (request.id === "stats" && !request.subresource) {
            if (request.method !== "GET") return request.notFound();
            return request.reply(200, { states: await this.persistence.countByState(SystemActor.actor) });
        }
        if (request.id === "kill-old" && !request.subresource) {
            if (request.method !== "POST") return request.notFound();
            const { before } = await request.body();
            const killed = await this.persistence.killOlderThan(new Date(before), SystemActor.actor);
            return request.reply(200, { killed });
        }
        if (request.id && request.subresource === "kill") {
            if (request.method !== "POST") return request.notFound();
            await this.persistence.kill(request.id, SystemActor.actor);
            return request.reply(204);
        }
        if (request.subresource) return request.notFound();
        if (request.id) return this.handleJob(request, request.id);
        return this.handleCollection(request);
    }

    private async handleJob(request : Request, id : string) : Promise<void> {
        switch (request.method) {
            case "PUT":
                await this.persistence.create(SystemActor.actor, deserializeJob(await request.body()));
                return request.reply(204);
            case "GET":
                return request.reply(200, serializeJob(await this.persistence.retrieve(id, SystemActor.actor)));
            case "DELETE":
                await this.persistence.delete(id, SystemActor.actor);
                return request.reply(204);
        }
        request.notFound();
    }

    private async handleCollection(request : Request) : Promise<void> {
        switch (request.method) {
            case "GET": {
                const pageSize = Number(request.query("pageSize") ?? 100);
                const page = Number(request.query("page") ?? 0);
                const jobs = await this.persistence.list(SystemActor.actor, pageSize, page);
                return request.reply(200, jobs.map(serializeJob));
            }
        }
        request.notFound();
    }

}

export { JobsHandler }
