import {createInterface} from "node:readline/promises";
import {CliConfig, CliFlags, DEFAULT_PLATFORM_URL} from "../CliConfig";
import {bold, check, dim, green} from "../ui/Ansi";
import {select} from "../ui/Select";

const ANBARIC_CLOUD_URL = "https://cloud.anbaric.ai";
const PING_TIMEOUT_MS = 1500;

class LoginCommand {

    async run(flags : CliFlags) : Promise<number> {
        const stored = await CliConfig.load();
        const platformUrl = flags.platformUrl ?? await this.choosePlatformUrl();
        const tenant = flags.tenant ?? await this.ask("Tenant", stored.tenant ?? "default");

        const path = await CliConfig.save({ platformUrl, tenant });

        console.log(`${check} Logged in to ${bold(platformUrl)} as tenant ${bold(tenant)}`);
        console.log(dim(`  saved to ${path} (authentication tokens will land here later)`));
        return 0;
    }

    private async choosePlatformUrl() : Promise<string> {
        const localDevRunning = await this.ping(DEFAULT_PLATFORM_URL);

        return select("Which platform do you want to use?", [
            {
                label: `Local Dev ${dim(`(${DEFAULT_PLATFORM_URL})`)}`,
                value: DEFAULT_PLATFORM_URL,
                hint: localDevRunning ? green("● running") : dim("○ not running"),
            },
            {
                label: `Anbaric Cloud ${dim(`(${ANBARIC_CLOUD_URL})`)}`,
                value: ANBARIC_CLOUD_URL,
            },
            {
                label: "Other:",
                editable: true,
            },
        ]);
    }

    private async ping(url : string) : Promise<boolean> {
        try {
            const response = await fetch(`${url}/ping`, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
            return response.ok;
        } catch {
            return false;
        }
    }

    private async ask(question : string, defaultAnswer : string) : Promise<string> {
        if (!process.stdin.isTTY) return defaultAnswer;

        const readline = createInterface({ input: process.stdin, output: process.stdout });
        const answer = (await readline.question(`${question} ${dim(`(${defaultAnswer})`)}: `)).trim();
        readline.close();
        return answer || defaultAnswer;
    }

}

export { LoginCommand }
