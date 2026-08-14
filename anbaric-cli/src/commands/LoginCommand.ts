import {createInterface} from "node:readline/promises";
import {CliConfig, CliFlags, DEFAULT_PLATFORM_URL} from "../CliConfig";
import {bold, check, dim} from "../ui/Ansi";

class LoginCommand {

    async run(flags : CliFlags) : Promise<number> {
        const stored = await CliConfig.load();
        const platformUrl = flags.platformUrl ?? await this.ask("Platform URL", stored.platformUrl ?? DEFAULT_PLATFORM_URL);
        const tenant = flags.tenant ?? await this.ask("Tenant", stored.tenant ?? "default");

        const path = await CliConfig.save({ platformUrl, tenant });

        console.log(`${check} Logged in to ${bold(platformUrl)} as tenant ${bold(tenant)}`);
        console.log(dim(`  saved to ${path} (authentication tokens will land here later)`));
        return 0;
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
