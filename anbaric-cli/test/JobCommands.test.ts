import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {PlatformClient} from "../src/PlatformClient";
import {JobCreateCommand} from "../src/commands/JobCreateCommand";
import {JobKillCommand} from "../src/commands/JobKillCommand";
import {JobKillOldCommand} from "../src/commands/JobKillOldCommand";
import {JobStatsCommand} from "../src/commands/JobStatsCommand";
import {JobSetStateCommand} from "../src/commands/JobSetStateCommand";
import {JobUpdateCommand} from "../src/commands/JobUpdateCommand";

type RecordedRequest = {
    method : string,
    path : string,
    body : any,
};

const startStubPlatform = (respond : (method : string, path : string) => any, recorded : Array<RecordedRequest>) :
    Promise<{ server : Server, baseUrl : string }> =>
    new Promise(resolve => {
        const server = createServer((request, response) => {
            const chunks : Array<Buffer> = [];
            request.on("data", chunk => chunks.push(chunk));
            request.on("end", () => {
                const raw = Buffer.concat(chunks).toString();
                const path = (request.url ?? "").replace(/^\/api\/v2/, "");
                recorded.push({
                    method: request.method ?? "",
                    path,
                    body: raw ? JSON.parse(raw) : undefined,
                });
                response.writeHead(200, { "content-type": "application/json" });
                response.end(JSON.stringify(respond(request.method ?? "", path)));
            });
        });
        server.listen(0, () => resolve({
            server,
            baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        }));
    });

describe("job commands", () => {

    const job = { id: "job-1", state: "review", properties: { name: "Ada" }, workflowId: "onboarding" };
    let recorded : Array<RecordedRequest>;
    let platform : Server;
    let client : PlatformClient;

    const respond = (_method : string, path : string) => {
        if (path === "/jobs/stats") return { states: [
            { state: "review", killed: false, count: 3 },
            { state: "review", killed: true, count: 1 },
            { state: "done", killed: false, count: 5 },
        ] };
        if (path === "/queue/size") return { size: 7 };
        if (path === "/jobs/kill-old") return { killed: 4 };
        if (path === "/state-machines") return [{ workflowId: "onboarding", url: "http://consumer" }];
        return job;
    };

    beforeEach(async () => {
        recorded = [];
        process.env.ANBARIC_CONFIG_DIR = "/nonexistent-anbaric-cli-test";
        const stub = await startStubPlatform(respond, recorded);
        platform = stub.server;
        client = new PlatformClient({ platformUrl: stub.baseUrl });
    });

    afterEach(async () => {
        delete process.env.ANBARIC_CONFIG_DIR;
        await new Promise<void>(resolve => platform.close(() => resolve()));
    });

    describe("create", () => {

        it("creates a job at the start state and queues it for processing", async () => {
            const exitCode = await new JobCreateCommand(client).run("onboarding", "review", ['name="Ada"', "age=42"]);

            expect(exitCode).toBe(0);
            expect(recorded.map(request => request.method)).toEqual(["GET", "PUT", "POST"]);

            const [, put, enqueue] = recorded;
            expect(put.path).toBe(`/jobs/${put.body.id}`);
            expect(put.body).toMatchObject({
                state: "review",
                workflowId: "onboarding",
                properties: { name: "Ada", age: 42 },
            });
            expect(put.body.startedAt).toBeTypeOf("string");
            expect(enqueue.path).toBe("/queue/enqueue");
            expect(enqueue.body).toEqual({ jobId: put.body.id, workflowId: "onboarding" });
        });

        it("rejects malformed property pairs before touching the platform", async () => {
            await expect(new JobCreateCommand(client).run("onboarding", "review", ["oops"]))
                .rejects.toThrowError('"oops" is not a property=value pair');
            expect(recorded).toEqual([]);
        });

    });

    describe("set-state", () => {

        it("saves the job with the new state and re-queues it", async () => {
            const exitCode = await new JobSetStateCommand(client).run("job-1", "done");

            expect(exitCode).toBe(0);
            expect(recorded.map(request => [request.method, request.path])).toEqual([
                ["GET", "/jobs/job-1"],
                ["PUT", "/jobs/job-1"],
                ["POST", "/queue/enqueue"],
            ]);
            expect(recorded[1].body).toMatchObject({
                ...job,
                state: "done",
                transitions: [{ from: "review", to: "done", actor: "anbaric-cli" }],
            });
            expect(recorded[1].body.lastUpdated).toBeTypeOf("string");
            expect(recorded[2].body).toEqual({ jobId: "job-1", workflowId: "onboarding" });
        });

    });

    describe("update", () => {

        it("merges properties into the job, saves it, and re-queues it", async () => {
            const exitCode = await new JobUpdateCommand(client).run("job-1", ["age=42", "tier=pro"]);

            expect(exitCode).toBe(0);
            expect(recorded.map(request => [request.method, request.path])).toEqual([
                ["GET", "/jobs/job-1"],
                ["PUT", "/jobs/job-1"],
                ["POST", "/queue/enqueue"],
            ]);
            expect(recorded[1].body).toMatchObject({
                ...job,
                properties: { name: "Ada", age: 42, tier: "pro" },
            });
            expect(recorded[1].body.lastUpdated).toBeTypeOf("string");
            expect(recorded[2].body).toEqual({ jobId: "job-1", workflowId: "onboarding" });
        });

        it("rejects malformed property pairs before touching the platform", async () => {
            await expect(new JobUpdateCommand(client).run("job-1", ["oops"]))
                .rejects.toThrowError('"oops" is not a property=value pair');
            expect(recorded).toEqual([]);
        });

    });

    describe("kill", () => {

        it("kills a live job", async () => {
            const exitCode = await new JobKillCommand(client).run("job-1");

            expect(exitCode).toBe(0);
            expect(recorded.map(request => [request.method, request.path])).toEqual([
                ["GET", "/jobs/job-1"],
                ["POST", "/jobs/job-1/kill"],
            ]);
        });

        it("does nothing when the job is already killed", async () => {
            const killedJob = { ...job, killed: true };
            const stub = await startStubPlatform(() => killedJob, recorded);
            const exitCode = await new JobKillCommand(new PlatformClient({ platformUrl: stub.baseUrl })).run("job-1");
            await new Promise<void>(resolve => stub.server.close(() => resolve()));

            expect(exitCode).toBe(0);
            expect(recorded.map(request => request.method)).toEqual(["GET"]);
        });

    });

    describe("stats", () => {

        it("fetches state counts and the queue size", async () => {
            const exitCode = await new JobStatsCommand(client).run();

            expect(exitCode).toBe(0);
            expect(recorded.map(request => [request.method, request.path])).toEqual([
                ["GET", "/jobs/stats"],
                ["GET", "/queue/size"],
            ]);
        });

    });

    describe("kill-old", () => {

        it("turns an age into a cutoff and posts it", async () => {
            const exitCode = await new JobKillOldCommand(client, true).run("7d");

            expect(exitCode).toBe(0);
            expect(recorded.map(request => [request.method, request.path])).toEqual([
                ["POST", "/jobs/kill-old"],
            ]);
            const before = new Date(recorded[0].body.before).getTime();
            const expected = Date.now() - 7 * 86_400_000;
            expect(Math.abs(before - expected)).toBeLessThan(60_000);
        });

        it("rejects an unparseable age before touching the platform", async () => {
            await expect(new JobKillOldCommand(client, true).run("soon"))
                .rejects.toThrowError('"soon" is not an age');
            expect(recorded).toEqual([]);
        });

    });

});
