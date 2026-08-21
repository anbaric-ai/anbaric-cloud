import {PlatformClient} from "../PlatformClient";
import {bold, check, dim} from "../ui/Ansi";

class JobKillCommand {

    constructor(private client : PlatformClient) {}

    async run(jobId : string) : Promise<number> {
        const job = await this.client.get(`/jobs/${encodeURIComponent(jobId)}`);
        if (job.killed) {
            console.log(dim(`job ${jobId} is already killed`));
            return 0;
        }

        await this.client.post(`/jobs/${encodeURIComponent(jobId)}/kill`, {});
        console.log(`${check} killed job ${bold(jobId)} ${dim(`(was in ${job.state})`)}`);
        return 0;
    }

}

export { JobKillCommand }
