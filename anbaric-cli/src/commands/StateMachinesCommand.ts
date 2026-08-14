import {PlatformClient} from "../PlatformClient";
import {dim} from "../ui/Ansi";
import {renderTable} from "../ui/Table";

class StateMachinesCommand {

    constructor(private client : PlatformClient) {}

    async run() : Promise<number> {
        const stateMachines = await this.client.get("/state-machines") as Array<{ workflowId : string, url : string }>;

        if (stateMachines.length === 0) {
            console.log(dim("No state machines registered — deploy an app that subscribes a consumer"));
            return 0;
        }

        console.log(renderTable(
            ["STATE MACHINE", "CONSUMER URL"],
            stateMachines.map(stateMachine => [stateMachine.workflowId, stateMachine.url]),
        ));
        return 0;
    }

}

export { StateMachinesCommand }
