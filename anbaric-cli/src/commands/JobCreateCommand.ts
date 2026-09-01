import {CliConfig} from "../CliConfig";
import {PlatformClient} from "../PlatformClient";
import {parsePropertyPairs} from "../PropertyPairs";
import {bold, check, cyan, dim} from "../ui/Ansi";

class JobCreateCommand {

    constructor(private client : PlatformClient) {}

    async run(workflowId : string, startState : string, pairs : Array<string>) : Promise<number> {
        const properties = parsePropertyPairs(pairs);
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const appId = await this.resolveAppId(workflowId);

        await this.client.put(`/jobs/${encodeURIComponent(id)}`, {
            id,
            state: startState,
            properties,
            workflowId,
            appId,
            startedBy: await this.actor(),
            startedAt: now,
            lastUpdated: now,
        });
        await this.client.post("/queue/enqueue", { jobId: id, appId, workflowId });

        console.log(`${check} created job ${bold(id)} in ${cyan(workflowId)} at state ${bold(startState)}`);
        console.log(dim(`  queued for processing by ${workflowId}`));
        return 0;
    }

    // A workflow is identified by (appId, workflowId); the id given on the
    // command line is the workflow's own id, so resolve the app it belongs to
    // from the registered state machines to route the job to the right consumer.
    private async resolveAppId(workflowId : string) : Promise<string | undefined> {
        const machines = await this.client.get("/state-machines") as Array<{ appId? : string, workflowId : string }>;
        const matches = machines.filter(machine => machine.workflowId === workflowId);
        if (matches.length > 1) {
            throw new Error(`Workflow "${workflowId}" exists in more than one app (${matches.map(match => match.appId ?? "—").join(", ")}); it cannot be addressed by workflow id alone.`);
        }
        return matches[0]?.appId;
    }

    private async actor() : Promise<string> {
        const key = await CliConfig.loadKey();
        return key ? `cli:${key.clientName}` : "anbaric-cli";
    }

}

export { JobCreateCommand }
