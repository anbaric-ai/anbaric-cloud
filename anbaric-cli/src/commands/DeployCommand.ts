import {spawn} from "node:child_process";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {AppConfig, AppConfigValues} from "../AppConfig";
import {PlatformClient} from "../PlatformClient";
import {bold, check, cross, dim, red} from "../ui/Ansi";
import {confirm} from "../ui/Prompt";
import {Spinner} from "../ui/Spinner";
import {ConfigureCommand} from "./ConfigureCommand";

const POLL_INTERVAL_MS = 1000;
const DEPLOY_TIMEOUT_MS = 600_000;

type DeployedApp = {
    appName : string,
    status : string,
    appPort : number,
    /* Where the platform serves this app. The platform decides it, because
       only it knows whether its apps have hostnames of their own, and on
       Anbaric Cloud the hostname is the app's own allocated address rather
       than anything derivable from its name. */
    url? : string,
};

class DeployCommand {

    constructor(private client : PlatformClient, private replaceWithoutAsking : boolean = false,
                private configureCommand : ConfigureCommand = new ConfigureCommand()) {}

    async run(appDirectory : string) : Promise<number> {
        const appDir = resolve(appDirectory);
        const config = await AppConfig.load(appDir) ?? await this.configureCommand.configure(appDir);

        const existingApps = await this.client.get("/apps") as Array<DeployedApp>;
        if (!await this.clearToDeploy(config, existingApps)) return 1;

        console.log(`Deploying ${bold(config.name)} to ${bold(this.client.platformUrl)}`);

        const spinner = new Spinner("packing application").start();
        const tarball = await this.pack(appDir);

        spinner.update("uploading bundle");
        await this.client.postBinary(
            `/apps/${encodeURIComponent(config.name)}/deploy?port=${config.internalPort}`, tarball, "application/gzip");

        spinner.update("building");
        const outcome = await this.awaitLive(config.name, spinner);
        spinner.stop();

        for (const line of outcome.log ?? []) console.log(dim(`  ${line}`));

        if (outcome.status === "running") {
            console.log(`${check} ${bold(config.name)} is live at ${bold(this.liveUrl(outcome, config.name))}`);
            return 0;
        }
        console.log(`${cross} Deployment of ${bold(config.name)} ${outcome.status}`);
        return 1;
    }

    /* The address the platform gave, made absolute. A platform that serves its
       apps by path answers with a path, which is only a link once the console's
       own address is in front of it. An older platform says nothing at all. */
    private liveUrl(app : { url? : string }, appName : string) : string {
        const url = app.url ?? `/app/${appName}`;

        return url.startsWith("/") ? `${this.client.platformUrl}${url}` : url;
    }

    private async clearToDeploy(config : AppConfigValues, existingApps : Array<DeployedApp>) : Promise<boolean> {
        // The internal port is bound inside the app's own container/task network
        // namespace, so two apps sharing a port never actually collide - no
        // cross-app uniqueness check is needed.
        const alreadyDeployed = existingApps.some(app => app.appName === config.name);
        if (alreadyDeployed && !this.replaceWithoutAsking) {
            if (!process.stdin.isTTY) {
                console.error(red(`${config.name} is already running - use \`anbaric update\` to replace it without prompting`));
                return false;
            }
            return confirm(`${config.name} is already running, do you want to replace it?`);
        }

        return true;
    }

    private async pack(appDir : string) : Promise<Buffer> {
        const workDir = await mkdtemp(join(tmpdir(), "anbaric-deploy-"));
        const tarballPath = join(workDir, "app.tar.gz");

        await new Promise<void>((resolvePacked, reject) => {
            const tar = spawn("tar", ["--no-xattrs", "-czf", tarballPath, "-C", appDir, "--exclude", "node_modules", "."]);
            tar.on("exit", code => code === 0 ? resolvePacked() : reject(new Error(`tar exited with code ${code}`)));
            tar.on("error", reject);
        });

        const tarball = await readFile(tarballPath);
        await rm(workDir, { recursive: true, force: true });
        return tarball;
    }

    private async awaitLive(appName : string, spinner : Spinner) : Promise<{ status : string, url? : string, log? : Array<string> }> {
        const deadline = Date.now() + DEPLOY_TIMEOUT_MS;

        while (Date.now() < deadline) {
            const status = await this.client.get(`/apps/${encodeURIComponent(appName)}`);
            if (status.status === "draining") {
                const inFlight = status.draining?.inFlight ?? 0;
                spinner.update(`draining ${dim(`(the running version is finishing ${inFlight} step${inFlight === 1 ? "" : "s"} in flight)`)}`);
            } else if (status.status === "building") {
                spinner.update(`building ${dim(`(${status.log?.at(-1) ?? "…"})`)}`);
            } else {
                return status;
            }
            await new Promise(resolvePoll => setTimeout(resolvePoll, POLL_INTERVAL_MS));
        }

        return { status: "timed out" };
    }

}

export { DeployCommand }
