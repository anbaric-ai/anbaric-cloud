import {PlatformClient} from "../PlatformClient";
import {bold, dim, green} from "../ui/Ansi";
import {confirm} from "../ui/Prompt";

class AppTearDownCommand {

    constructor(private client : PlatformClient, private yes : boolean = false) {}

    async run(appName : string) : Promise<number> {
        if (!this.yes && !await confirm(`Tear down ${bold(appName)} on ${this.client.platformUrl}? This stops and removes the app.`)) {
            console.error(dim("Aborted — pass --yes to tear down without a prompt."));
            return 1;
        }

        await this.client.delete(`/apps/${encodeURIComponent(appName)}`);
        console.log(`${green("✓")} torn down ${bold(appName)}`);
        return 0;
    }

}

export { AppTearDownCommand }
