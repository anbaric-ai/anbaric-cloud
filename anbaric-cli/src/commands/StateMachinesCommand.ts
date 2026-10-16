import {PlatformClient} from "../PlatformClient";
import {dim} from "../ui/Ansi";
import {renderTable} from "../ui/Table";

type RegisteredStateMachine = { appId? : string, workflowId : string, url? : string, version : number, lastRegistered : string };

const relative = (iso : string) : string => {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
};

class StateMachinesCommand {

    constructor(private client : PlatformClient) {}

    async run() : Promise<number> {
        const stateMachines = await this.client.get("/state-machines") as Array<RegisteredStateMachine>;

        if (stateMachines.length === 0) {
            console.log(dim("No state machines registered — deploy an app that subscribes a consumer"));
            return 0;
        }

        console.log(renderTable(
            ["APP", "STATE MACHINE", "VERSION", "LAST REGISTERED", "CONSUMER URL"],
            stateMachines.map(stateMachine => [
                stateMachine.appId ?? "",
                stateMachine.workflowId,
                String(stateMachine.version ?? ""),
                stateMachine.lastRegistered ? relative(stateMachine.lastRegistered) : "",
                stateMachine.url ?? "",
            ]),
        ));
        return 0;
    }

}

export { StateMachinesCommand }
