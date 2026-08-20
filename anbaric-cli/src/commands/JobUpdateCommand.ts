import {PlatformClient} from "../PlatformClient";
import {bold, check, dim} from "../ui/Ansi";
import {parsePropertyPairs} from "../PropertyPairs";

class JobUpdateCommand {

    constructor(private client : PlatformClient) {}

    async run(jobId : string, pairs : Array<string>) : Promise<number> {
        const properties = parsePropertyPairs(pairs);

        const job = await this.client.get(`/jobs/${encodeURIComponent(jobId)}`);
        job.properties = { ...(job.properties ?? {}), ...properties };
        job.lastUpdated = new Date().toISOString();
        await this.client.put(`/jobs/${encodeURIComponent(jobId)}`, job);

        const updates = Object.entries(properties)
            .map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(" ");
        console.log(`${check} job ${jobId}: set ${bold(updates)}`);
        return this.requeue(jobId, job.workflowId);
    }

    private async requeue(jobId : string, workflowId? : string) : Promise<number> {
        if (!workflowId) {
            console.log(dim("  job has no workflow id, so it was not re-queued for processing"));
            return 0;
        }
        await this.client.post("/queue/enqueue", { jobId, workflowId });
        console.log(dim(`  re-queued for processing by ${workflowId}`));
        return 0;
    }

}

export { JobUpdateCommand }
