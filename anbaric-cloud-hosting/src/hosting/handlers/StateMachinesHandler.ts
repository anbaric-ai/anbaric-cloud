import {RegisteredStateMachine, StateMachineStore} from "../../data-store/StateMachineStore";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* The latest version of each registered machine, without its definition:
   that is for the console's graphs, and would swamp a listing. */
const summarize = (machine : RegisteredStateMachine) => ({
    ...(machine.appId ? { appId: machine.appId } : {}),
    workflowId: machine.workflowId,
    ...(machine.url ? { url: machine.url } : {}),
    version: machine.version,
    registeredAt: machine.registeredAt.toISOString(),
    lastRegistered: machine.lastRegistered.toISOString(),
});

class StateMachinesHandler implements RequestHandler {

    constructor(private stateMachines : StateMachineStore) {}

    async handle(request : Request) : Promise<void> {
        if (request.id) return request.notFound();

        switch (request.method) {
            case "GET":
                return request.reply(200, (await this.stateMachines.list()).map(summarize));
        }
        request.notFound();
    }

}

export { StateMachinesHandler }
