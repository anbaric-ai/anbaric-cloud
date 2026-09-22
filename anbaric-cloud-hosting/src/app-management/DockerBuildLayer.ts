import {spawn} from "node:child_process";
import {writeFile} from "node:fs/promises";
import {join} from "node:path";
import {BaseBuildLayer, Deployment, Probe} from "./BaseBuildLayer";
import {DocGenerator} from "../docs/DocGenerator";
import {childLines} from "./childLines";

type LogStreamer = (container : string, signal : AbortSignal) => AsyncIterable<string>;

const dockerLogStreamer : LogStreamer = (container, signal) =>
    childLines(spawn("docker", ["logs", "--follow", "--tail", "50", container]), signal);

type DockerBuildLayerOptions = {
    baseImage : string,
    network : string,
    platformUrl : string,
    sqlDatabaseUrl? : string,
    sqlSchema? : string,
    docGenerator? : DocGenerator,
};

type CommandRunner = (command : string, args : Array<string>, onOutput : (line : string) => void) => Promise<void>;

const spawnRunner : CommandRunner = (command, args, onOutput) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args);
        child.stdout.on("data", chunk => onOutput(String(chunk).trimEnd()));
        child.stderr.on("data", chunk => onOutput(String(chunk).trimEnd()));
        child.on("exit", code => code === 0
            ? resolve()
            : reject(new Error(`${command} ${args[0]} exited with code ${code}`)));
        child.on("error", reject);
    });

/* Third-party dependencies are installed into the app image at build time.
   The anbaric-* packages are already present as symlinks to the base image
   (linked by BaseBuildLayer), and `npm install` leaves satisfied dependencies
   in place, so it only fetches the app's own registry dependencies - the
   anbaric packages keep coming from the base image, not the registry. It must
   be `install`, not `ci`: `ci` empties node_modules first and would delete
   those symlinks. */
const dockerfileFor = (baseImage : string, entryPoint : string) : string => `FROM ${baseImage}
COPY . /anbaric-app
WORKDIR /anbaric-app
RUN npm install --omit=dev --no-audit --no-fund
CMD ["/anbaric/node_modules/.bin/tsx", "/anbaric/node_modules/anbaric-cloud-hosting/src/app-admin/launch.ts", "${entryPoint}"]
`;

class DockerBuildLayer extends BaseBuildLayer {

    constructor(appsDir : string, private options : DockerBuildLayerOptions,
                consumerPortBase? : number,
                private runCommand : CommandRunner = spawnRunner, probe? : Probe,
                private logStreamer : LogStreamer = dockerLogStreamer) {
        super(appsDir, consumerPortBase, probe);
        this.docGenerator = options.docGenerator;
    }

    protected async diagnostics(deployment : Deployment) : Promise<Array<string>> {
        return new Promise((resolve) => {
            const lines : Array<string> = [];
            const take = (buffer : Buffer) => {
                for (const line of buffer.toString().split("\n")) if (line.trim()) lines.push(line);
            };
            const logs = spawn("docker", ["logs", "--tail", "30", this.appHostFor(deployment.appName)]);
            logs.stdout.on("data", take);
            logs.stderr.on("data", take);
            logs.on("close", () => resolve(lines.slice(-30)));
            logs.on("error", () => resolve([]));
        });
    }

    protected appHostFor(appName : string) : string {
        return `anbaric-app-${appName}`;
    }

    protected streamLogs(deployment : Deployment, signal : AbortSignal) : AsyncIterable<string> {
        return this.logStreamer(this.appHostFor(deployment.appName), signal);
    }

    protected async start(deployment : Deployment, appDir : string, entryPoint : string) : Promise<void> {
        const image = this.appHostFor(deployment.appName);
        const container = this.appHostFor(deployment.appName);

        await writeFile(join(appDir, "Dockerfile"), dockerfileFor(this.options.baseImage, entryPoint));
        this.log(deployment, `baking image ${image}`);
        await this.docker(deployment, ["build", "-t", image, appDir]);

        await this.removeContainer(deployment, container);

        const sqlEnv = this.options.sqlDatabaseUrl ? [
            "--env", "ANBARIC_SQL_STORE_TYPE=cloud",
            "--env", `ANBARIC_SQL_DATABASE_URL=${this.options.sqlDatabaseUrl}`,
            "--env", `ANBARIC_SQL_SCHEMA=${this.options.sqlSchema ?? "anbaric_app_data"}`,
        ] : [];

        this.log(deployment, `starting container ${container}`);
        await this.docker(deployment, ["run", "--detach", "--name", container,
            "--network", this.options.network,
            "--env", `PORT=${deployment.appPort}`,
            "--env", `ANBARIC_APP_ID=${deployment.appName}`,
            "--env", `ANBARIC_ADMIN_PORT=${deployment.adminPort}`,
            "--env", `ANBARIC_CLOUD_URL=${this.options.platformUrl}`,
            "--env", "ANBARIC_JOB_PERSISTENCE_TYPE=cloud",
            "--env", "ANBARIC_QUEUE_TYPE=cloud",
            "--env", "ANBARIC_JSON_STORE_TYPE=cloud",
            "--env", "ANBARIC_SECRET_STORE_TYPE=cloud",
            "--env", "ANBARIC_AUDITOR_TYPE=cloud",
            "--env", "ANBARIC_SESSION_RESOLVER_TYPE=cloud",
            "--env", "ANBARIC_ENTITLEMENTS_TYPE=cloud",
            "--env", "ANBARIC_PROMPT_MANAGER_TYPE=cloud",
            "--env", "ANBARIC_NOTIFIER_TYPE=cloud",
            "--env", `ANBARIC_CONSUMER_PORT=${deployment.consumerPort}`,
            "--env", `ANBARIC_CONSUMER_URL=http://${container}:${deployment.consumerPort}`,
            ...sqlEnv,
            image]);

        void this.docker(deployment, ["logs", "--follow", container]).catch(() => {});
    }

    protected async stop(deployment : Deployment) : Promise<void> {
        await this.removeContainer(deployment, this.appHostFor(deployment.appName));
    }

    // Locally the extracted source from the last deploy is still on disk, so
    // regeneration reads it in place with nothing to clean up.
    protected async sourceDir(appName : string) : Promise<{ dir : string, cleanup : () => Promise<void> }> {
        return { dir: join(this.appsDir, appName), cleanup: async () => {} };
    }

    private async removeContainer(deployment : Deployment, container : string) : Promise<void> {
        await this.docker(deployment, ["rm", "--force", container]).catch(() => {});
    }

    private docker(deployment : Deployment, args : Array<string>) : Promise<void> {
        return this.runCommand("docker", args, line => this.log(deployment, line));
    }

}

export { DockerBuildLayer, dockerfileFor };
export type { CommandRunner, DockerBuildLayerOptions, LogStreamer };
