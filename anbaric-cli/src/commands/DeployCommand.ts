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
            console.log(`${check} ${bold(config.name)} is live at ${bold(`${this.client.platformUrl}/${config.name}`)}`);
            return 0;
        }
        console.log(`${cross} Deployment of ${bold(config.name)} ${outcome.status}`);
        return 1;
    }

    private async clearToDeploy(config : AppConfigValues, existingApps : Array<DeployedApp>) : Promise<boolean> {
        const portClash = existingApps.find(app => app.appPort === config.internalPort && app.appName !== config.name);
        if (portClash) {
            console.error(red(`Port ${config.internalPort} is already in use by application ${portClash.appName} - run \`anbaric configure\` to change the app port`));
            return false;
        }

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

    private async awaitLive(appName : string, spinner : Spinner) : Promise<{ status : string, log? : Array<string> }> {
        const deadline = Date.now() + DEPLOY_TIMEOUT_MS;

        while (Date.now() < deadline) {
            const status = await this.client.get(`/apps/${encodeURIComponent(appName)}`);
            if (status.status !== "building") return status;
            spinner.update(`building ${dim(`(${status.log?.at(-1) ?? "…"})`)}`);
            await new Promise(resolvePoll => setTimeout(resolvePoll, POLL_INTERVAL_MS));
        }

        return { status: "timed out" };
    }

}

export { DeployCommand }
