import {ChildProcess, spawn} from "node:child_process";
import {mkdir, readFile, rm, symlink, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {BuildLayer, DeploymentStatus, DeploymentSummary} from "./BuildLayer";

type Deployment = {
    appName : string,
    status : DeploymentStatus,
    appPort : number,
    appHost : string,
    consumerPort : number,
    log : Array<string>,
    process? : ChildProcess,
    replaces? : Deployment,
};

type Probe = (host : string, port : number) => Promise<boolean>;

const LOG_LIMIT = 200;
const LIVENESS_TIMEOUT_MS = 30_000;
const LIVENESS_PROBE_INTERVAL_MS = 250;

const httpProbe : Probe = async (host, port) => {
    try {
        await fetch(`http://${host}:${port}/`, { signal: AbortSignal.timeout(LIVENESS_PROBE_INTERVAL_MS) });
        return true;
    } catch {
        return false;
    }
};

abstract class BaseBuildLayer implements BuildLayer {

    protected deployments = new Map<string, Deployment>();
    private nextAppIndex = 0;

    constructor(protected appsDir : string, private consumerPortBase : number = 8800,
                private probe : Probe = httpProbe) {}

    deploy(appName : string, appPort : number, tarball : Buffer) : DeploymentSummary {
        const existing = this.deployments.get(appName);

        const deployment : Deployment = {
            appName,
            status: "building",
            appPort,
            appHost: this.appHostFor(appName),
            consumerPort: existing?.consumerPort ?? this.consumerPortBase + this.nextAppIndex++,
            log: [],
            replaces: existing,
        };
        this.deployments.set(appName, deployment);

        void this.buildAndStart(deployment, tarball).catch(error => {
            deployment.status = "failed";
            this.log(deployment, `build failed: ${error instanceof Error ? error.message : error}`);
        });

        return this.summarize(deployment);
    }

    status(appName : string) : (DeploymentSummary & { log : Array<string> }) | undefined {
        const deployment = this.deployments.get(appName);
        return deployment && { ...this.summarize(deployment), log: deployment.log.slice(-20) };
    }

    list() : Array<DeploymentSummary> {
        return Array.from(this.deployments.values(), deployment => this.summarize(deployment));
    }

    async cleanUp() : Promise<void> {
        await Promise.all(Array.from(this.deployments.values(), deployment => {
            deployment.status = "stopped";
            return this.stop(deployment);
        }));
    }

    protected abstract appHostFor(appName : string) : string;
    protected abstract start(deployment : Deployment, appDir : string, entryPoint : string) : Promise<void>;
    protected abstract stop(deployment : Deployment) : Promise<void>;

    private async buildAndStart(deployment : Deployment, tarball : Buffer) : Promise<void> {
        const appDir = join(this.appsDir, deployment.appName);
        await rm(appDir, { recursive: true, force: true });
        await mkdir(appDir, { recursive: true });

        const tarballPath = join(this.appsDir, `${deployment.appName}.tar.gz`);
        await writeFile(tarballPath, tarball);
        this.log(deployment, "extracting application bundle");
        await this.run(deployment, "tar", ["-xzf", tarballPath, "-C", appDir]);

        this.log(deployment, "linking anbaric workspace packages");
        const manifest = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
        await this.linkWorkspacePackages(appDir, manifest);

        if (deployment.replaces) await this.stop(deployment.replaces);

        if (!this.isCurrent(deployment)) return;
        await this.start(deployment, appDir, manifest.main);
        await this.awaitLive(deployment);
    }

    protected isCurrent(deployment : Deployment) : boolean {
        return this.deployments.get(deployment.appName) === deployment && deployment.status === "building";
    }

    private async awaitLive(deployment : Deployment) : Promise<void> {
        const deadline = Date.now() + LIVENESS_TIMEOUT_MS;

        while (Date.now() < deadline) {
            if (deployment.status !== "building") return;
            if (await this.probe(deployment.appHost, deployment.appPort)) {
                deployment.status = "running";
                this.log(deployment, `app is live at ${deployment.appHost}:${deployment.appPort}`);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, LIVENESS_PROBE_INTERVAL_MS));
        }

        await this.stop(deployment);
        deployment.status = "failed";
        this.log(deployment, `app did not respond at ${deployment.appHost}:${deployment.appPort} within ${LIVENESS_TIMEOUT_MS / 1000}s`);
    }

    private async linkWorkspacePackages(appDir : string, manifest : { dependencies? : Record<string, string> }) : Promise<void> {
        const workspacePackages = await this.workspacePackages();
        await mkdir(join(appDir, "node_modules"), { recursive: true });

        for (const dependency of Object.keys(manifest.dependencies ?? {})) {
            const workspaceDir = workspacePackages.get(dependency);
            if (workspaceDir) await symlink(workspaceDir, join(appDir, "node_modules", dependency));
        }
    }

    private async workspacePackages() : Promise<Map<string, string>> {
        const root = process.cwd();
        const rootManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
        const packages = new Map<string, string>();

        for (const workspace of rootManifest.workspaces ?? []) {
            const manifest = JSON.parse(await readFile(join(root, workspace, "package.json"), "utf8"));
            packages.set(manifest.name, join(root, workspace));
        }

        return packages;
    }

    protected run(deployment : Deployment, command : string, args : Array<string>) : Promise<void> {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args);
            child.stdout.on("data", chunk => this.log(deployment, String(chunk).trimEnd()));
            child.stderr.on("data", chunk => this.log(deployment, String(chunk).trimEnd()));
            child.on("exit", code => code === 0
                ? resolve()
                : reject(new Error(`${command} exited with code ${code}`)));
            child.on("error", reject);
        });
    }

    protected summarize(deployment : Deployment) : DeploymentSummary {
        return {
            appName: deployment.appName,
            status: deployment.status,
            appPort: deployment.appPort,
            appHost: deployment.appHost,
        };
    }

    protected log(deployment : Deployment, line : string) : void {
        deployment.log.push(line);
        if (deployment.log.length > LOG_LIMIT) deployment.log.shift();
    }

}

export { BaseBuildLayer, httpProbe };
export type { Deployment, Probe };
