import {PlatformClient} from "../PlatformClient";
import {bold, cyan, dim} from "../ui/Ansi";
import {Spinner} from "../ui/Spinner";

const POLL_INTERVAL_MS = 1000;

class WatchCommand {

    constructor(private client : PlatformClient) {}

    async run(jobId : string) : Promise<number> {
        let lastState : string | undefined;
        let lastProperties = "";
        const spinner = new Spinner(`watching job ${jobId}`).start();

        process.on("SIGINT", () => {
            spinner.stop(dim("stopped watching"));
            process.exit(0);
        });

        while (true) {
            const job = await this.client.get(`/jobs/${encodeURIComponent(jobId)}`);
            const properties = JSON.stringify(job.properties);

            if (job.state !== lastState || properties !== lastProperties) {
                const stamp = dim(new Date().toISOString());
                const transition = lastState === undefined
                    ? `state ${bold(job.state)}`
                    : `state ${dim(lastState)} ${cyan("→")} ${bold(job.state)}`;
                spinner.stop();
                console.log(`${stamp}  ${transition}  ${dim(properties)}`);
                spinner.start();
                lastState = job.state;
                lastProperties = properties;
            }

            spinner.update(`watching job ${jobId} ${dim(`(state: ${job.state})`)}`);
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }

}

export { WatchCommand }
