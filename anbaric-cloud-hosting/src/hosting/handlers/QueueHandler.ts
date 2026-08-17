import {ConfirmableQueue} from "../../queuing/ConfirmableQueue";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class QueueHandler implements RequestHandler {

    constructor(private queue : ConfirmableQueue) {}

    async handle(request : Request) : Promise<void> {
        if (request.method !== "POST" || !request.id || request.subresource) return request.notFound();

        switch (request.id) {
            case "enqueue": {
                const { jobId, workflowId } = await request.body();
                await this.queue.enqueue(jobId, workflowId);
                return request.reply(204);
            }
            case "schedule": {
                const { jobId, workflowId, due } = await request.body();
                await this.queue.schedule(jobId, workflowId, new Date(due));
                return request.reply(204);
            }
            case "dequeue":
                return request.reply(200, { messages: await this.queue.dequeueSome() });
            case "confirm": {
                const { jobId, workflowId } = await request.body();
                await this.queue.confirm({ jobId, workflowId });
                return request.reply(204);
            }
        }
        request.notFound();
    }

}

export { QueueHandler }
