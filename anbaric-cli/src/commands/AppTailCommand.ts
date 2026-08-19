import {PlatformClient} from "../PlatformClient";
import {dim} from "../ui/Ansi";

class AppTailCommand {

    constructor(private client : PlatformClient) {}

    async run(appName : string) : Promise<number> {
        const controller = new AbortController();
        const stop = () => controller.abort();
        process.on("SIGINT", stop);

        console.error(dim(`tailing ${appName} logs from ${this.client.platformUrl} — Ctrl-C to stop`));

        try {
            await this.client.stream(
                `/apps/${encodeURIComponent(appName)}/logs`,
                text => process.stdout.write(text),
                controller.signal,
            );
            return 0;
        } catch (error) {
            if (controller.signal.aborted) return 0;
            throw error;
        } finally {
            process.off("SIGINT", stop);
        }
    }

}

export { AppTailCommand }
