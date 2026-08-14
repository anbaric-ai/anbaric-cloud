import {ChildProcess, spawn} from "node:child_process";
import {mkdir, readFile, rm, symlink, writeFile} from "node:fs/promises";
import {join} from "node:path";

type DeploymentStatus = "building" | "running" | "failed" | "stopped";

type Deployment = {
    appName : string,
    status : DeploymentStatus,
    appPort : number,
    consumerPort : number,
    log : Array<string>,
    process? : ChildProcess,
};

const LOG_LIMIT = 200;

class BuildLayer {

    private deployments = new Map<string, Deployment>();
    private nextAppIndex = 0;

    constructor(private appsDir : string, private platformUrl : string,
                private appPortBase : number = 9000, private consumerPortBase : number = 8800) {}

    deploy(appName : string, tarball : Buffer) : { appName : string, status : DeploymentStatus, appPort : number } {
        const existing = this.deployments.get(appName);
        existing?.process?.kill();

        const index = existing ? this.indexOf(existing) : this.nextAppIndex++;
        const deployment : Deployment = {
            appName,
            status: "building",
            appPort: this.appPortBase + index,
            consumerPort: this.consumerPortBase + index,
            log: [],
        };
        this.deployments.set(appName, deployment);

        void this.build(deployment, tarball).catch(error => {
            deployment.status = "failed";
            this.log(deployment, `build failed: ${error instanceof Error ? error.message : error}`);
        });

        return this.statusOf(deployment);
    }

    status(appName : string) : { appName : string, status : DeploymentStatus, appPort : number, log : Array<string> } | undefined {
        const deployment = this.deployments.get(appName);
        return deployment && { ...this.statusOf(deployment), log: deployment.log.slice(-20) };
    }

    list() : Array<{ appName : string, status : DeploymentStatus, appPort : number }> {
        return Array.from(this.deployments.values(), deployment => this.statusOf(deployment));
    }

    async cleanUp() : Promise<void> {
        for (const deployment of this.deployments.values()) {
            deployment.process?.kill();
            deployment.status = "stopped";
        }
    }

    private statusOf(deployment : Deployment) {
        return { appName: deployment.appName, status: deployment.status, appPort: deployment.appPort };
    }

    private indexOf(deployment : Deployment) : number {
        return deployment.appPort - this.appPortBase;
    }

    private async build(deployment : Deployment, tarball : Buffer) : Promise<void> {
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

        this.start(deployment, appDir, manifest.main);
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

    private start(deployment : Deployment, appDir : string, entryPoint : string) : void {
        this.log(deployment, `starting ${entryPoint} on port ${deployment.appPort}`);

        const app = spawn(join(process.cwd(), "node_modules", ".bin", "tsx"), [entryPoint], {
            cwd: appDir,
            env: {
                ...process.env,
                PORT: String(deployment.appPort),
                ANBARIC_CLOUD_URL: this.platformUrl,
                ANBARIC_JOB_PERSISTENCE_TYPE: "cloud",
                ANBARIC_QUEUE_TYPE: "cloud",
                ANBARIC_CONSUMER_TYPE: "cloud",
                ANBARIC_CONSUMER_PORT: String(deployment.consumerPort),
                ANBARIC_CONSUMER_URL: `http://localhost:${deployment.consumerPort}`,
            },
        });

        deployment.process = app;
        deployment.status = "running";

        app.stdout.on("data", chunk => this.log(deployment, String(chunk).trimEnd()));
        app.stderr.on("data", chunk => this.log(deployment, String(chunk).trimEnd()));
        app.on("exit", (code) => {
            deployment.status = code === 0 || app.killed ? "stopped" : "failed";
            this.log(deployment, `process exited with code ${code}`);
        });
    }

    private run(deployment : Deployment, command : string, args : Array<string>) : Promise<void> {
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

    private log(deployment : Deployment, line : string) : void {
        deployment.log.push(line);
        if (deployment.log.length > LOG_LIMIT) deployment.log.shift();
    }

}

export { BuildLayer }
