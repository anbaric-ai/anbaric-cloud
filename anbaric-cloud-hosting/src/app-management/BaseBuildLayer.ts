import {ChildProcess, spawn} from "node:child_process";
import {mkdir, readFile, rm, symlink, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {adminPing} from "../app-admin/adminPing";
import {DocGenerator} from "../docs/DocGenerator";
import {BuildLayer, DeploymentStatus, DeploymentSummary} from "./BuildLayer";

type Deployment = {
    appName : string,
    status : DeploymentStatus,
    appPort : number,
    appHost : string,
    adminPort : number,
    consumerPort : number,
    log : Array<string>,
    process? : ChildProcess,
    replaces? : Deployment,
    draining? : { inFlight : number, since : number },
};

type Probe = (host : string, port : number) => Promise<boolean>;

const LOG_LIMIT = 200;
const LIVENESS_TIMEOUT_MS = 30_000;
const LIVENESS_PROBE_INTERVAL_MS = 250;
const APP_ADMIN_PORT = 8791;
/* How long a running app is given to finish the steps it has in hand before
   it is replaced or removed regardless. Long enough for real work, short
   enough that a step that will never finish cannot hold a deploy hostage. */
const DRAIN_TIMEOUT_MS = 5 * 60_000;
const DRAIN_POLL_INTERVAL_MS = 2_000;

/* Liveness is the built-in admin server answering `ping` on the admin port, so
   an app that serves no HTTP still passes. */
const adminProbe : Probe = (host, port) => adminPing(host, port, LIVENESS_PROBE_INTERVAL_MS);

abstract class BaseBuildLayer implements BuildLayer {

    protected deployments = new Map<string, Deployment>();
    protected docGenerator? : DocGenerator;
    consumerUrlsFor : (appName : string) => Array<string> = () => [];
    private nextAppIndex = 0;
    private hydration? : Promise<void>;

    constructor(protected appsDir : string, private consumerPortBase : number = 8800,
                private probe : Probe = adminProbe,
                private livenessTimeoutMs : number = LIVENESS_TIMEOUT_MS,
                private drainTimeoutMs : number = DRAIN_TIMEOUT_MS,
                private drainPollIntervalMs : number = DRAIN_POLL_INTERVAL_MS) {}

    /* The deployments map is rebuilt from the durable backend the first time the
       app registry is read, so apps survive a platform restart. A failed
       rehydration is not cached, so a later request retries. */
    ensureHydrated() : Promise<void> {
        return this.hydration ??= this.rehydrate().catch(error => {
            this.hydration = undefined;
            console.warn(`Could not rehydrate the app registry: ${error instanceof Error ? error.message : error}`);
        });
    }

    protected async rehydrate() : Promise<void> {}

    deploy(appName : string, appPort : number, tarball : Buffer) : DeploymentSummary {
        const existing = this.deployments.get(appName);

        const deployment : Deployment = {
            appName,
            status: "building",
            appPort,
            appHost: this.appHostFor(appName),
            adminPort: APP_ADMIN_PORT,
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

    async ping(appName : string) : Promise<boolean> {
        const deployment = this.deployments.get(appName);
        if (!deployment || deployment.status !== "running") return false;
        return adminPing(deployment.appHost, deployment.adminPort, LIVENESS_PROBE_INTERVAL_MS);
    }

    async *logs(appName : string, signal : AbortSignal) : AsyncGenerator<string> {
        const deployment = this.deployments.get(appName);
        if (!deployment) throw new Error(`No app named "${appName}"`);
        yield* this.streamLogs(deployment, signal);
    }

    async teardown(appName : string) : Promise<DeploymentSummary | undefined> {
        const deployment = this.deployments.get(appName);
        if (!deployment) return undefined;

        // An app with consumers to drain is drained in the background and the
        // caller polls; one with nothing to drain is gone by the time this
        // returns. Either way stop() runs while the deployment is still the
        // mapped one, so the Fargate guard lets it delete the service.
        const finish = async () => {
            deployment.status = "stopped";
            await this.stop(deployment);
            if (this.deployments.get(appName) === deployment) this.deployments.delete(appName);
        };

        if (deployment.status === "running" && this.consumerUrlsFor(appName).length > 0) {
            void this.drain(deployment, deployment).then(finish);
            return this.summarize(deployment);
        }

        await finish();
        return this.summarize(deployment);
    }

    /* Asks the running app to finish what it has in hand before it goes. The
       app's consumers are told to stop accepting (the platform's pushes are
       refused unconfirmed, so nothing is lost - it waits for the replacement)
       and polled until nothing is in flight or the drain timeout passes;
       `shown` is the deployment whose status the caller is watching. */
    protected async drain(shown : Deployment, running : Deployment) : Promise<void> {
        const urls = [...new Set(this.consumerUrlsFor(running.appName))];
        if (urls.length === 0) return;

        const previous = shown.status;
        shown.status = "draining";
        shown.draining = { inFlight: 0, since: Date.now() };
        this.log(shown, `draining ${running.appName}: asking it to finish what it has in hand`);

        await Promise.all(urls.map(url => fetch(`${url}/drain`, { method: "POST" }).catch(() => undefined)));

        const deadline = Date.now() + this.drainTimeoutMs;
        let inFlight = await this.inFlightAt(urls);
        while (inFlight > 0 && Date.now() < deadline) {
            shown.draining.inFlight = inFlight;
            await new Promise(resolve => setTimeout(resolve, this.drainPollIntervalMs));
            inFlight = await this.inFlightAt(urls);
        }

        this.log(shown, inFlight === 0
            ? "drained: nothing in flight"
            : `drain timed out after ${this.drainTimeoutMs / 1000}s with ${inFlight} step(s) in flight; going ahead`);
        shown.draining = undefined;
        if (shown.status === "draining") shown.status = previous;
    }

    // The steps in flight across the app's consumers; one that cannot be
    // reached counts as idle, since nothing can be waited for there.
    private async inFlightAt(urls : Array<string>) : Promise<number> {
        const counts = await Promise.all(urls.map(async url => {
            try {
                const health = await (await fetch(`${url}/health`)).json() as { inFlight? : number };
                return Number(health.inFlight ?? 0);
            } catch {
                return 0;
            }
        }));
        return counts.reduce((total, count) => total + count, 0);
    }

    async cleanUp() : Promise<void> {
        await Promise.all(Array.from(this.deployments.values(), deployment => {
            deployment.status = "stopped";
            return this.stop(deployment);
        }));
    }

    // Regenerates an app's docs from its uploaded source without redeploying it:
    // the source is materialised (from S3 for Fargate, from disk for Docker) and
    // the same generator that runs on deploy is invoked against it.
    async regenerateDocs(appName : string) : Promise<number> {
        if (!this.deployments.has(appName)) throw new Error(`No app named "${appName}"`);
        if (!this.docGenerator) throw new Error("Documentation generation is not configured on this platform");

        const { dir, cleanup } = await this.sourceDir(appName);
        try {
            return await this.docGenerator.generate(appName, dir, { redeploy: true });
        } finally {
            await cleanup();
        }
    }

    protected abstract appHostFor(appName : string) : string;
    protected abstract start(deployment : Deployment, appDir : string, entryPoint : string) : Promise<void>;
    protected abstract stop(deployment : Deployment) : Promise<void>;
    protected abstract streamLogs(deployment : Deployment, signal : AbortSignal) : AsyncIterable<string>;
    // Materialises the app's source into a directory for regeneration; the
    // returned cleanup removes anything temporary the implementation created.
    protected abstract sourceDir(appName : string) : Promise<{ dir : string, cleanup : () => Promise<void> }>;

    private async buildAndStart(deployment : Deployment, tarball : Buffer) : Promise<void> {
        const appDir = join(this.appsDir, deployment.appName);
        await rm(appDir, { recursive: true, force: true });
        await mkdir(appDir, { recursive: true });

        const tarballPath = join(this.appsDir, `${deployment.appName}.tar.gz`);
        await writeFile(tarballPath, tarball);
        this.log(deployment, "extracting application bundle");
        await this.run(deployment, "tar", ["-xzf", tarballPath, "-C", appDir]);

        // Documentation is generated off the critical path: fire-and-forget from
        // the extracted source, before the build, so a slow model call can never
        // delay or fail the deploy. Regenerated on every deploy, replaces=redeploy.
        void this.docGenerator?.generate(deployment.appName, appDir, { redeploy: !!deployment.replaces })
            .catch(error => this.log(deployment, `doc generation skipped: ${error instanceof Error ? error.message : error}`));

        this.log(deployment, "linking anbaric workspace packages");
        const manifest = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
        await this.linkWorkspacePackages(appDir, manifest);

        // The version being replaced finishes its work first; the build above
        // ran while it carried on, so the drain is the only pause it sees.
        if (deployment.replaces) {
            if (deployment.replaces.status === "running") await this.drain(deployment, deployment.replaces);
            if (!this.isCurrent(deployment)) return;
            await this.stop(deployment.replaces);
        }

        if (!this.isCurrent(deployment)) return;
        await this.start(deployment, appDir, manifest.main);
        await this.awaitLive(deployment);
    }

    protected isCurrent(deployment : Deployment) : boolean {
        return this.deployments.get(deployment.appName) === deployment && deployment.status === "building";
    }

    private async awaitLive(deployment : Deployment) : Promise<void> {
        const deadline = Date.now() + this.livenessTimeoutMs;

        while (Date.now() < deadline) {
            if (deployment.status !== "building") return;
            if (await this.probe(deployment.appHost, deployment.adminPort)) {
                deployment.status = "running";
                this.log(deployment, `app is live (admin port ${deployment.adminPort})`);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, LIVENESS_PROBE_INTERVAL_MS));
        }

        // The admin port never answering almost always means the app process
        // crashed on boot, so pull whatever it logged and put the real cause in
        // the deploy result - not just the timeout, which says nothing.
        const diagnostics = await this.diagnostics(deployment).catch(() => []);

        await this.stop(deployment);
        deployment.status = "failed";
        this.log(deployment, `app admin port ${deployment.adminPort} did not answer within ${this.livenessTimeoutMs / 1000}s`);
        if (diagnostics.length > 0) {
            this.log(deployment, "the app's last output before it stopped:");
            for (const line of diagnostics) this.log(deployment, `  ${line}`);
        } else {
            this.log(deployment, "no output was captured - the app may have failed before logging, or is still starting");
        }
    }

    // The app's recent output, for diagnosing a boot that never became live.
    // Each build layer reads it from where its apps log (container logs,
    // CloudWatch); the default has nothing to offer.
    protected async diagnostics(_deployment : Deployment) : Promise<Array<string>> {
        return [];
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
            ...(deployment.draining
                ? { draining: { inFlight: deployment.draining.inFlight, since: new Date(deployment.draining.since).toISOString() } }
                : {}),
        };
    }

    protected log(deployment : Deployment, line : string) : void {
        deployment.log.push(line);
        if (deployment.log.length > LOG_LIMIT) deployment.log.shift();
    }

}

export { BaseBuildLayer, adminProbe };
export type { Deployment, Probe };
