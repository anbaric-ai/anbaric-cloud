import {resolve} from "node:path";
import {AppConfig, AppConfigValues, isValidAppName} from "../AppConfig";
import {bold, check, dim, red} from "../ui/Ansi";
import {ask} from "../ui/Prompt";

const DEFAULT_INTERNAL_PORT = 3000;

class ConfigureCommand {

    async run(appDirectory : string) : Promise<number> {
        const config = await this.configure(resolve(appDirectory));

        console.log(`${check} Configured ${bold(config.name)} on internal port ${bold(String(config.internalPort))}`);
        return 0;
    }

    async configure(appDir : string) : Promise<AppConfigValues> {
        const existing = await AppConfig.load(appDir);

        const name = await this.askForName(existing?.name ?? await AppConfig.suggestedName(appDir));
        const internalPort = await this.askForPort(existing?.internalPort ?? DEFAULT_INTERNAL_PORT);

        const config = { name, internalPort };
        const path = await AppConfig.save(appDir, config);
        console.log(dim(`  saved to ${path}`));
        return config;
    }

    private async askForName(defaultName : string) : Promise<string> {
        while (true) {
            const name = await ask("App name", defaultName);
            if (isValidAppName(name)) return name;

            const problem = `App names may only contain lowercase letters, numbers, "-" and "_"`;
            if (!process.stdin.isTTY) throw new Error(`Invalid app name "${name}": ${problem}`);
            console.log(red(problem));
        }
    }

    private async askForPort(defaultPort : number) : Promise<number> {
        while (true) {
            const answer = await ask("Internal port", String(defaultPort));
            const port = Number(answer);
            if (Number.isInteger(port) && port > 0 && port < 65536) return port;

            if (!process.stdin.isTTY) throw new Error(`Invalid internal port "${answer}"`);
            console.log(red("The internal port must be a number between 1 and 65535"));
        }
    }

}

export { ConfigureCommand }
