import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {spawn} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {readFile} from "node:fs/promises";
import {QueueMessage} from "anbaric-tsapi";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {BuildLayer} from "../src/BuildLayer";
import {ConfirmableQueue} from "../src/ConfirmableQueue";
import {HostingServer} from "../src/HostingServer";

const APP_PORT_BASE = 9100;
const CONSUMER_PORT_BASE = 8900;

class ConfirmableInMemoryQueue extends InMemoryQueue implements ConfirmableQueue {

    async confirm(_message : QueueMessage) : Promise<void> {}

}

const writeFixtureApp = async (dir : string, greeting : string) : Promise<void> => {
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "package.json"), JSON.stringify({
        name: "fixture-app",
        type: "module",
        main: "src/main.ts",
        dependencies: { "anbaric-tsapi": "*" },
    }));
    await writeFile(join(dir, "src", "main.ts"), `
        import {createServer} from "node:http";
        import {Job} from "anbaric-tsapi";

        const job = new Job("boot-check", new Map(), "start");
        const server = createServer((request, response) => {
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ greeting: "${greeting}", bootJob: job.id }));
        });
        server.listen(Number(process.env.PORT), () => console.log("fixture app up"));
    `);
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

describe("BuildLayer via the hosting API", () => {

    let workDir : string;
    let buildLayer : BuildLayer;
    let server : HostingServer;
    let baseUrl : string;

    beforeEach(async () => {
        workDir = await mkdtemp(join(tmpdir(), "anbaric-build-"));
        buildLayer = new BuildLayer(join(workDir, "apps"), "http://localhost:0", APP_PORT_BASE, CONSUMER_PORT_BASE);
        await mkdir(join(workDir, "apps"), { recursive: true });
        server = new HostingServer(new InMemoryJobPersistence(), new ConfirmableInMemoryQueue(), undefined, buildLayer);
        baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    });

    afterEach(async () => {
        await buildLayer.cleanUp();
        await server.close();
        await rm(workDir, { recursive: true, force: true });
    });

    const deployFixture = async (greeting : string) => {
        const fixtureDir = join(workDir, "fixture");
        await rm(fixtureDir, { recursive: true, force: true });
        await writeFixtureApp(fixtureDir, greeting);
        const tarball = await packFixture(fixtureDir);

        return fetch(`${baseUrl}/apps/fixture-app/deploy`, {
            method: "POST",
            headers: { "content-type": "application/gzip" },
            body: new Uint8Array(tarball),
        });
    };

    const awaitRunning = async () => {
        await vi.waitFor(async () => {
            const status = await (await fetch(`${baseUrl}/apps/fixture-app`)).json();
            expect(status.status).toBe("running");
        }, { timeout: 10_000 });
    };

    it("accepts a tarball and reports the deployment as building", async () => {
        const response = await deployFixture("hello");

        expect(response.status).toBe(202);
        expect(await response.json()).toEqual({
            appName: "fixture-app",
            status: "building",
            appPort: APP_PORT_BASE,
        });
    });

    it("builds, links workspace packages, and runs the app on its assigned port", async () => {
        await deployFixture("hello");
        await awaitRunning();

        await vi.waitFor(async () => {
            const body = await (await fetch(`http://127.0.0.1:${APP_PORT_BASE}`)).json();
            expect(body).toEqual({ greeting: "hello", bootJob: "boot-check" });
        }, { timeout: 10_000 });
    });

    it("replaces the running app on redeploy", async () => {
        await deployFixture("first");
        await awaitRunning();

        await deployFixture("second");
        await awaitRunning();

        await vi.waitFor(async () => {
            const body = await (await fetch(`http://127.0.0.1:${APP_PORT_BASE}`)).json();
            expect(body.greeting).toBe("second");
        }, { timeout: 10_000 });
    });

    it("lists deployed apps", async () => {
        await deployFixture("hello");
        await awaitRunning();

        const apps = await (await fetch(`${baseUrl}/apps`)).json();

        expect(apps).toEqual([{ appName: "fixture-app", status: "running", appPort: APP_PORT_BASE }]);
    });

    it("rejects an empty deploy body", async () => {
        const response = await fetch(`${baseUrl}/apps/fixture-app/deploy`, { method: "POST" });

        expect(response.status).toBe(400);
    });

    it("returns 404 for an unknown app's status", async () => {
        const response = await fetch(`${baseUrl}/apps/never-deployed`);

        expect(response.status).toBe(404);
    });

});
