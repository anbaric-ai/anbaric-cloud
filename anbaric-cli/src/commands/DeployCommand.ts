import {spawn} from "node:child_process";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {PlatformClient} from "../PlatformClient";
import {bold, check, cross, dim} from "../ui/Ansi";
import {Spinner} from "../ui/Spinner";

const POLL_INTERVAL_MS = 1000;
const DEPLOY_TIMEOUT_MS = 60_000;

class DeployCommand {

    constructor(private client : PlatformClient) {}

    async run(appDirectory : string) : Promise<number> {
        const appDir = resolve(appDirectory);
        const manifest = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
        const appName = manifest.name;

        console.log(`Deploying ${bold(appName)} to ${bold(this.client.platformUrl)}`);

        const spinner = new Spinner("packing application").start();
        const tarball = await this.pack(appDir);

        spinner.update("uploading bundle");
        const accepted = await this.client.postBinary(
            `/apps/${encodeURIComponent(appName)}/deploy`, tarball, "application/gzip");

        spinner.update(`building (app port ${accepted.appPort})`);
        const outcome = await this.awaitOutcome(appName, spinner);
        spinner.stop();

        for (const line of outcome.log ?? []) console.log(dim(`  ${line}`));

        if (outcome.status === "running") {
            console.log(`${check} ${bold(appName)} is running on port ${bold(String(accepted.appPort))}`);
            return 0;
        }
        console.log(`${cross} Deployment of ${bold(appName)} ${outcome.status}`);
        return 1;
    }

    private async pack(appDir : string) : Promise<Buffer> {
        const workDir = await mkdtemp(join(tmpdir(), "anbaric-deploy-"));
        const tarballPath = join(workDir, "app.tar.gz");

        await new Promise<void>((resolvePacked, reject) => {
            const tar = spawn("tar", ["-czf", tarballPath, "-C", appDir, "--exclude", "node_modules", "."]);
            tar.on("exit", code => code === 0 ? resolvePacked() : reject(new Error(`tar exited with code ${code}`)));
            tar.on("error", reject);
        });

        const tarball = await readFile(tarballPath);
        await rm(workDir, { recursive: true, force: true });
        return tarball;
    }

    private async awaitOutcome(appName : string, spinner : Spinner) : Promise<{ status : string, log? : Array<string> }> {
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
