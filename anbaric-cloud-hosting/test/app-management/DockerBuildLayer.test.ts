import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {CommandRunner, DockerBuildLayer} from "../../src/app-management/DockerBuildLayer";

const APP_PORT = 4000;
const CONSUMER_PORT_BASE = 8950;

const writeFixtureApp = async (dir : string) : Promise<void> => {
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "package.json"), JSON.stringify({
        name: "fixture-app",
        type: "module",
        main: "src/main.ts",
        dependencies: { "anbaric-tsapi": "*" },
    }));
    await writeFile(join(dir, "src", "main.ts"), "export {};");
};

const packFixture = async (dir : string) : Promise<Buffer> => {
    const tarballPath = join(dir, "..", "fixture.tar.gz");
    await new Promise<void>((resolve, reject) => {
        const tar = spawn("tar", ["-czf", tarballPath, "-C", dir, "."]);
        tar.on("exit", code => code === 0 ? resolve() : reject(new Error(`tar exited with ${code}`)));
        tar.on("error", reject);
    });
    return readFile(tarballPath);
};

describe("DockerBuildLayer", () => {

    let workDir : string;
    let dockerCommands : Array<Array<string>>;
    let buildLayer : DockerBuildLayer;

    const recordingRunner : CommandRunner = async (command, args) => {
        if (command === "docker") dockerCommands.push(args);
    };

    beforeEach(async () => {
        workDir = await mkdtemp(join(tmpdir(), "anbaric-docker-"));
        await mkdir(join(workDir, "apps"), { recursive: true });
        dockerCommands = [];
        buildLayer = new DockerBuildLayer(
            join(workDir, "apps"),
            { baseImage: "anbaric-base:test", network: "anbaric-test-net", platformUrl: "http://platform:8787" },
            CONSUMER_PORT_BASE,
            recordingRunner,
            async () => true,
        );
    });

    afterEach(async () => {
        await buildLayer.cleanUp();
        await rm(workDir, { recursive: true, force: true });
    });

    const deployFixture = async () => {
        const fixtureDir = join(workDir, "fixture");
        await writeFixtureApp(fixtureDir);
        buildLayer.deploy("fixture-app", APP_PORT, await packFixture(fixtureDir));
        await vi.waitFor(() => expect(buildLayer.status("fixture-app")?.status).toBe("running"));
    };

    const commandsNamed = (subcommand : string) => dockerCommands.filter(args => args[0] === subcommand);

    it("bakes the app onto the pre-canned base image", async () => {
        await deployFixture();

        const dockerfile = await readFile(join(workDir, "apps", "fixture-app", "Dockerfile"), "utf8");
        expect(dockerfile).toBe(`FROM anbaric-base:test
COPY . /anbaric-app
WORKDIR /anbaric-app
RUN npm install --omit=dev --no-audit --no-fund
CMD ["/anbaric/node_modules/.bin/tsx", "src/main.ts"]
`);
        expect(commandsNamed("build")[0]).toEqual([
            "build", "-t", "anbaric-app-fixture-app", join(workDir, "apps", "fixture-app"),
        ]);
    });

    it("runs the baked image as a named container on the platform network", async () => {
        await deployFixture();

        const run = commandsNamed("run")[0];
        expect(run.slice(0, 5)).toEqual([
            "run", "--detach", "--name", "anbaric-app-fixture-app", "--network",
        ]);
        expect(run).toContain("anbaric-test-net");
        expect(run).toContain(`PORT=${APP_PORT}`);
        expect(run).toContain("ANBARIC_CLOUD_URL=http://platform:8787");
        expect(run).toContain("ANBARIC_JOB_PERSISTENCE_TYPE=cloud");
        expect(run).toContain("ANBARIC_QUEUE_TYPE=cloud");
        expect(run).toContain("ANBARIC_JSON_STORE_TYPE=cloud");
        expect(run).toContain("ANBARIC_SECRET_STORE_TYPE=cloud");
        expect(run).toContain(`ANBARIC_CONSUMER_URL=http://anbaric-app-fixture-app:${CONSUMER_PORT_BASE}`);
        expect(run[run.length - 1]).toBe("anbaric-app-fixture-app");
    });

    it("reports the container name as the app host", async () => {
        await deployFixture();

        expect(buildLayer.status("fixture-app")).toMatchObject({
            appHost: "anbaric-app-fixture-app",
            appPort: APP_PORT,
            status: "running",
        });
    });

    it("force-removes the old container before starting a replacement", async () => {
        await deployFixture();
        dockerCommands = [];

        await deployFixture();

        const removeIndex = dockerCommands.findIndex(args => args[0] === "rm");
        const runIndex = dockerCommands.findIndex(args => args[0] === "run");
        expect(dockerCommands[removeIndex]).toEqual(["rm", "--force", "anbaric-app-fixture-app"]);
        expect(removeIndex).toBeLessThan(runIndex);
    });

    it("removes containers on cleanUp", async () => {
        await deployFixture();
        dockerCommands = [];

        await buildLayer.cleanUp();

        expect(commandsNamed("rm")[0]).toEqual(["rm", "--force", "anbaric-app-fixture-app"]);
    });

});
