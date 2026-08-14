import {CliConfig, CliFlags, DEFAULT_PLATFORM_URL} from "../CliConfig";
import {KeyRequest} from "../KeyRequest";
import {openBrowser} from "../BrowserOpener";
import {bold, check, dim, green} from "../ui/Ansi";
import {ask} from "../ui/Prompt";
import {select} from "../ui/Select";
import {Spinner} from "../ui/Spinner";

const ANBARIC_CLOUD_URL = "https://cloud.anbaric.ai";
const PING_TIMEOUT_MS = 1500;

class LoginCommand {

    async run(flags : CliFlags) : Promise<number> {
        const stored = await CliConfig.load();
        const platformUrl = flags.platformUrl ?? await this.choosePlatformUrl();
        const tenant = flags.tenant ?? await this.ask("Tenant", stored.tenant ?? "default");

        const path = await CliConfig.save({ platformUrl, tenant });
        console.log(`${check} Using ${bold(platformUrl)} as tenant ${bold(tenant)} ${dim(`(saved to ${path})`)}`);

        if (!await this.requiresAuthentication(platformUrl)) {
            console.log(dim("  this platform has authentication disabled, so no key is needed"));
            return 0;
        }

        return this.authorizeTerminal(platformUrl);
    }

    private async authorizeTerminal(platformUrl : string) : Promise<number> {
        const request = new KeyRequest(platformUrl);

        console.log(`\nOpening your browser to authorize this terminal. If nothing opens, visit:\n  ${bold(request.authorizeUrl)}\n`);
        openBrowser(request.authorizeUrl);

        const spinner = new Spinner("waiting for the browser authorization").start();
        try {
            const key = await request.awaitKey();
            spinner.stop();
            const keyPath = await CliConfig.saveKey(key);
            console.log(`${check} This terminal is now authorized as ${bold(key.clientName)}`);
            console.log(dim(`  keypair saved to ${keyPath}`));
            return 0;
        } catch (error) {
            spinner.stop();
            throw error;
        }
    }

    private async requiresAuthentication(platformUrl : string) : Promise<boolean> {
        try {
            const response = await fetch(`${platformUrl}/whoami`, {
                redirect: "manual",
                signal: AbortSignal.timeout(PING_TIMEOUT_MS),
            });
            return response.status !== 404;
        } catch {
            return false;
        }
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
        return ask(question, defaultAnswer);
    }

}

export { LoginCommand }
