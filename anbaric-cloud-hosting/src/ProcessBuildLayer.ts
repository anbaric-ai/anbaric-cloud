import {ChildProcess, spawn} from "node:child_process";
import {join} from "node:path";
import {BaseBuildLayer, Deployment, Probe} from "./BaseBuildLayer";

const EXIT_GRACE_MS = 3000;

class ProcessBuildLayer extends BaseBuildLayer {

    constructor(appsDir : string, private platformUrl : string,
                consumerPortBase? : number, probe? : Probe) {
        super(appsDir, consumerPortBase, probe);
    }

    protected appHostFor() : string {
        return "localhost";
    }

    protected async start(deployment : Deployment, appDir : string, entryPoint : string) : Promise<void> {
        this.log(deployment, `starting ${entryPoint} on port ${deployment.appPort}`);

        const app = spawn(join(process.cwd(), "node_modules", ".bin", "tsx"), [entryPoint], {
            cwd: appDir,
            env: {
                ...process.env,
                PORT: String(deployment.appPort),
                ANBARIC_CLOUD_URL: this.platformUrl,
                ANBARIC_JOB_PERSISTENCE_TYPE: "cloud",
                ANBARIC_QUEUE_TYPE: "cloud",
                ANBARIC_JSON_STORE_TYPE: "cloud",
                ANBARIC_SECRET_STORE_TYPE: "cloud",
                ANBARIC_CONSUMER_PORT: String(deployment.consumerPort),
                ANBARIC_CONSUMER_URL: `http://localhost:${deployment.consumerPort}`,
            },
        });

        deployment.process = app;

        app.stdout.on("data", chunk => this.log(deployment, String(chunk).trimEnd()));
        app.stderr.on("data", chunk => this.log(deployment, String(chunk).trimEnd()));
        app.on("exit", (code) => {
            deployment.status = code === 0 || app.killed ? "stopped" : "failed";
            this.log(deployment, `process exited with code ${code}`);
        });
    }

    protected async stop(deployment : Deployment) : Promise<void> {
        deployment.process?.kill();
        await this.awaitExit(deployment.process);
    }

    private awaitExit(child? : ChildProcess) : Promise<void> {
        if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();

        return new Promise(resolve => {
            const forceKill = setTimeout(() => child.kill("SIGKILL"), EXIT_GRACE_MS);
            forceKill.unref();
            child.once("exit", () => {
                clearTimeout(forceKill);
                resolve();
            });
        });
    }

}

export { ProcessBuildLayer }
