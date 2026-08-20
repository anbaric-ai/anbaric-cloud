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

        await this.client.put(`/jobs/${encodeURIComponent(id)}`, {
            id,
            state: startState,
            properties,
            workflowId,
            startedBy: await this.actor(),
            startedAt: now,
            lastUpdated: now,
        });
        await this.client.post("/queue/enqueue", { jobId: id, workflowId });

        console.log(`${check} created job ${bold(id)} in ${cyan(workflowId)} at state ${bold(startState)}`);
        console.log(dim(`  queued for processing by ${workflowId}`));
        return 0;
    }

    private async actor() : Promise<string> {
        const key = await CliConfig.loadKey();
        return key ? `cli:${key.clientName}` : "anbaric-cli";
    }

}

export { JobCreateCommand }
