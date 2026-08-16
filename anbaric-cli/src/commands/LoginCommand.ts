import {CliConfig, CliFlags, DEFAULT_PLATFORM_URL, PRODUCTION_PLATFORM_URL, STAGING_PLATFORM_URL, platformUrlForEnvironment} from "../CliConfig";
import {KeyRequest} from "../KeyRequest";
import {openBrowser} from "../BrowserOpener";
import {bold, check, dim, green} from "../ui/Ansi";
import {select} from "../ui/Select";
import {Spinner} from "../ui/Spinner";

const PING_TIMEOUT_MS = 1500;

class LoginCommand {

    async run(flags : CliFlags, environment? : string) : Promise<number> {
        const platformUrl = flags.platformUrl
            ?? (environment ? platformUrlForEnvironment(environment) : await this.choosePlatformUrl());

        if (!await this.requiresAuthentication(platformUrl)) {
            const path = await CliConfig.save({ platformUrl, tenant: flags.tenant });
            console.log(`${check} Using ${bold(platformUrl)} ${dim(`(saved to ${path})`)}`);
            console.log(dim("  this platform has authentication disabled, so no key is needed"));
            return 0;
        }

        return this.authorizeTerminal(platformUrl, flags);
    }

    private async authorizeTerminal(platformUrl : string, flags : CliFlags) : Promise<number> {
        const request = new KeyRequest(platformUrl);

        console.log(`\nOpening your browser to authorize this terminal. If nothing opens, visit:\n  ${bold(request.authorizeUrl)}\n`);
        openBrowser(request.authorizeUrl);

        const spinner = new Spinner("waiting for the browser authorization").start();
        try {
            const key = await request.awaitKey();
            spinner.stop();
            const keyPath = await CliConfig.saveKey(key);
            const tenant = key.tenant ?? flags.tenant;
            const path = await CliConfig.save({ platformUrl, tenant });

            console.log(`${check} This terminal is now authorized as ${bold(key.clientName)}`);
            if (tenant) console.log(`${check} Logged into tenant ${bold(tenant)}`);
            console.log(dim(`  keypair saved to ${keyPath}, config to ${path}`));
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
        if (!process.stdin.isTTY) {
            throw new Error("No terminal to ask in - pass --platform-url or --environment local|staging|production");
        }
        const localDevRunning = await this.ping(DEFAULT_PLATFORM_URL);

        return select("Which platform do you want to use?", [
            ...(localDevRunning ? [{
                label: `Local Dev ${dim(`(${DEFAULT_PLATFORM_URL})`)}`,
                value: DEFAULT_PLATFORM_URL,
                hint: green("● running"),
            }] : []),
            { label: "Anbaric Cloud", value: PRODUCTION_PLATFORM_URL },
            { label: "Anbaric Cloud (Staging)", value: STAGING_PLATFORM_URL },
            { label: "Other:", editable: true },
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

}

export { LoginCommand }
