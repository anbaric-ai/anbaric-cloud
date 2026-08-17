import {ConsumerRegistry} from "../../queuing/ConsumerRegistry";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class ConsumersHandler implements RequestHandler {

    constructor(private registry : ConsumerRegistry) {}

    async handle(request : Request) : Promise<void> {
        if (request.id) return request.notFound();

        switch (request.method) {
            case "POST": {
                const { workflowId, url } = await request.body();
                this.registry.register(workflowId, url);
                return request.reply(204);
            }
        }
        request.notFound();
    }

}

export { ConsumersHandler }
