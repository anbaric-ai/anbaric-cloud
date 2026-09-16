import {PlatformClient} from "../PlatformClient";
import {bold, check, dim} from "../ui/Ansi";
import {Spinner} from "../ui/Spinner";

class RegenerateDocsCommand {

    constructor(private client : PlatformClient) {}

    async run(appName : string) : Promise<number> {
        const spinner = new Spinner(`regenerating documentation for ${appName}`).start();
        try {
            const result = await this.client.post(`/apps/${encodeURIComponent(appName)}/docs`, {});
            spinner.stop();

            const docs = Number(result?.docs ?? 0);
            if (docs > 0) {
                console.log(`${check} Regenerated ${bold(String(docs))} doc(s) for ${bold(appName)}`);
            } else {
                console.log(dim(`  No docs were generated for ${appName} - is the AI gateway configured on this platform?`));
            }
            return 0;
        } catch (error) {
            spinner.stop();
            throw error;
        }
    }

}

export { RegenerateDocsCommand }
