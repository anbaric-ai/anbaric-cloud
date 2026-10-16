import {ConsumerRegistry} from "../../queuing/ConsumerRegistry";
import {StateMachineStore} from "../../data-store/StateMachineStore";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* Where an app's state machines announce themselves. The registry answers
   for messages that carry no app id; the store is what outlives a restart
   and what the listings read. */
class ConsumersHandler implements RequestHandler {

    constructor(private registry : ConsumerRegistry, private stateMachines : StateMachineStore) {}

    async handle(request : Request) : Promise<void> {
        if (request.id) return request.notFound();

        switch (request.method) {
            case "POST": {
                const { appId, workflowId, url, definition } = (await request.body()) ?? {};
                if (typeof workflowId !== "string" || typeof url !== "string") {
                    return request.reply(400, { error: "Expected a body of { workflowId, url } with an optional appId and definition" });
                }
                this.registry.register(appId, workflowId, url);
                await this.stateMachines.register({ appId: appId || undefined, workflowId, url, definition });
                return request.reply(204);
            }
        }
        request.notFound();
    }

}

export { ConsumersHandler }
