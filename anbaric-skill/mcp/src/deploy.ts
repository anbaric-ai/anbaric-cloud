import {spawn} from "node:child_process";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {AppConfig} from "../../../anbaric-cli/src/AppConfig";
import {PlatformClient} from "../../../anbaric-cli/src/PlatformClient";

const POLL_INTERVAL_MS = 1000;
const DEPLOY_TIMEOUT_MS = 600_000;

type DeployOutcome = {
    name : string,
    status : string,
    url? : string,
    log? : Array<string>,
};

const deployApp = async (client : PlatformClient, directory : string) : Promise<DeployOutcome> => {
    const appDir = resolve(directory);
    const config = await AppConfig.load(appDir);
    if (!config) {
        throw new Error(`${appDir} has no .anbaric/app-config.json - it needs a { "name", "internalPort" } before it can be deployed`);
    }

    const tarball = await pack(appDir);
    await client.postBinary(
        `/apps/${encodeURIComponent(config.name)}/deploy?port=${config.internalPort}`, tarball, "application/gzip");

    const outcome = await awaitLive(client, config.name);
    const live = outcome.status === "running";
    return {
        name: config.name,
        status: outcome.status,
        url: live ? `${client.platformUrl}/app/${config.name}` : undefined,
        log: outcome.log,
    };
};

const pack = async (appDir : string) : Promise<Buffer> => {
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
};

const awaitLive = async (client : PlatformClient, appName : string) : Promise<{ status : string, log? : Array<string> }> => {
    const deadline = Date.now() + DEPLOY_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const status = await client.get(`/apps/${encodeURIComponent(appName)}`);
        if (status.status !== "building") return status;
        await new Promise(resolvePoll => setTimeout(resolvePoll, POLL_INTERVAL_MS));
    }
    return { status: "timed out" };
};

export {deployApp};
export type {DeployOutcome};
