import {CliConfig, CliFlags, DEFAULT_PLATFORM_URL, productionUrlFor, stagingUrlFor} from "../CliConfig";
import {KeyRequest} from "../KeyRequest";
import {openBrowser} from "../BrowserOpener";
import {bold, check, dim, green} from "../ui/Ansi";
import {ask} from "../ui/Prompt";
import {select} from "../ui/Select";
import {Spinner} from "../ui/Spinner";

const PING_TIMEOUT_MS = 1500;
const CLOUD_CHOICE = "anbaric-cloud";
const STAGING_CHOICE = "anbaric-cloud-staging";

class LoginCommand {

    async run(flags : CliFlags) : Promise<number> {
        const stored = await CliConfig.load();
        const platformUrl = flags.platformUrl ?? await this.choosePlatformUrl(flags.tenant ?? stored.tenant);

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
            if (tenant) console.log(`${check} You are on the ${bold(tenant)} tenant`);
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

    private async choosePlatformUrl(storedTenant? : string) : Promise<string> {
        const localDevRunning = await this.ping(DEFAULT_PLATFORM_URL);

        const choice = await select("Which platform do you want to use?", [
            ...(localDevRunning ? [{
                label: `Local Dev ${dim(`(${DEFAULT_PLATFORM_URL})`)}`,
                value: DEFAULT_PLATFORM_URL,
                hint: green("● running"),
            }] : []),
            { label: "Anbaric Cloud", value: CLOUD_CHOICE },
            { label: "Anbaric Cloud (Staging)", value: STAGING_CHOICE },
            { label: "Other:", editable: true },
        ]);

        if (choice !== CLOUD_CHOICE && choice !== STAGING_CHOICE) return choice;

        const tenant = await this.askForTenant(storedTenant);
        return choice === CLOUD_CHOICE ? productionUrlFor(tenant) : stagingUrlFor(tenant);
    }

    private async askForTenant(storedTenant? : string) : Promise<string> {
        while (true) {
            const tenant = (await ask("Tenant", storedTenant ?? "")).trim();
            if (tenant.length > 0) return tenant;
            console.log(dim("  a tenant is needed to reach your Anbaric Cloud platform"));
        }
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
