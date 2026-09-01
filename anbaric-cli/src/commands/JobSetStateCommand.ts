import {CliConfig} from "../CliConfig";
import {PlatformClient} from "../PlatformClient";
import {bold, check, cyan, dim} from "../ui/Ansi";

class JobSetStateCommand {

    constructor(private client : PlatformClient) {}

    async run(jobId : string, state : string) : Promise<number> {
        const job = await this.client.get(`/jobs/${encodeURIComponent(jobId)}`);
        const previousState = job.state;

        job.state = state;
        job.transitions = [...(job.transitions ?? []), { from: previousState, to: state, actor: await this.actor() }];
        job.lastUpdated = new Date().toISOString();
        await this.client.put(`/jobs/${encodeURIComponent(jobId)}`, job);

        console.log(`${check} job ${jobId}: state ${dim(previousState)} ${cyan("→")} ${bold(state)}`);
        return this.requeue(jobId, job.appId, job.workflowId);
    }

    private async actor() : Promise<string> {
        const key = await CliConfig.loadKey();
        return key ? `cli:${key.clientName}` : "anbaric-cli";
    }

    private async requeue(jobId : string, appId : string | undefined, workflowId? : string) : Promise<number> {
        if (!workflowId) {
            console.log(dim("  job has no workflow id, so it was not re-queued for processing"));
            return 0;
        }
        await this.client.post("/queue/enqueue", { jobId, appId, workflowId });
        console.log(dim(`  re-queued for processing by ${workflowId}`));
        return 0;
    }

}

export { JobSetStateCommand }
