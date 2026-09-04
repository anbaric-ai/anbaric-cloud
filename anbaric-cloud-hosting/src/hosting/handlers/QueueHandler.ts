import {RemoteQueue} from "../../queuing/RemoteQueue";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class QueueHandler implements RequestHandler {

    constructor(private queue : RemoteQueue) {}

    async handle(request : Request) : Promise<void> {
        if (request.subresource) return request.notFound();

        if (request.method === "GET" && request.id === "size") {
            return request.reply(200, { size: await this.queue.size() });
        }

        if (request.method !== "POST" || !request.id) return request.notFound();

        switch (request.id) {
            case "enqueue": {
                const { jobId, appId, workflowId } = await request.body();
                await this.queue.enqueue(jobId, appId, workflowId);
                return request.reply(204);
            }
            case "schedule": {
                const { jobId, appId, workflowId, due } = await request.body();
                await this.queue.schedule(jobId, appId, workflowId, new Date(due));
                return request.reply(204);
            }
            case "dequeue":
                return request.reply(200, { messages: await this.queue.dequeueSome() });
            case "confirm": {
                const { jobId, appId, workflowId, position } = await request.body();
                await this.queue.confirm({ jobId, appId, workflowId, position });
                return request.reply(204);
            }
        }
        request.notFound();
    }

}

export { QueueHandler }
