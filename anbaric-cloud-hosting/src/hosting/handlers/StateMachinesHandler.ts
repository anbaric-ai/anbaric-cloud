import {ConsumerRegistry} from "../../queuing/ConsumerRegistry";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

class StateMachinesHandler implements RequestHandler {

    constructor(private registry : ConsumerRegistry) {}

    async handle(request : Request) : Promise<void> {
        if (request.id) return request.notFound();

        switch (request.method) {
            case "GET":
                return request.reply(200, this.registry.list());
        }
        request.notFound();
    }

}

export { StateMachinesHandler }
