import {PlatformClient} from "../PlatformClient";
import {bold, dim, green} from "../ui/Ansi";
import {confirm} from "../ui/Prompt";
import {Spinner} from "../ui/Spinner";

const POLL_INTERVAL_MS = 1000;
const DRAIN_TIMEOUT_MS = 6 * 60_000;

/* Tears an app down. One that is running its jobs is drained first - the
   platform answers "draining" and finishes the removal once the app has
   completed what it had in hand - so this waits, showing what is left. */
class AppTearDownCommand {

    constructor(private client : PlatformClient, private yes : boolean = false) {}

    async run(appName : string) : Promise<number> {
        if (!this.yes && !await confirm(`Tear down ${bold(appName)} on ${this.client.platformUrl}? This stops and removes the app.`)) {
            console.error(dim("Aborted — pass --yes to tear down without a prompt."));
            return 1;
        }

        const outcome = await this.client.delete(`/apps/${encodeURIComponent(appName)}`);
        if (outcome?.status === "draining") await this.awaitGone(appName);

        console.log(`${green("✓")} torn down ${bold(appName)}`);
        return 0;
    }

    private async awaitGone(appName : string) : Promise<void> {
        const spinner = new Spinner("draining");
        const deadline = Date.now() + DRAIN_TIMEOUT_MS;

        try {
            while (Date.now() < deadline) {
                const status = await this.client.get(`/apps/${encodeURIComponent(appName)}`).catch(() => undefined);
                if (!status || status.status !== "draining") return;
                const inFlight = status.draining?.inFlight ?? 0;
                spinner.update(`draining ${dim(`(finishing ${inFlight} step${inFlight === 1 ? "" : "s"} in flight)`)}`);
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
            }
        } finally {
            spinner.stop();
        }
    }

}

export { AppTearDownCommand }
