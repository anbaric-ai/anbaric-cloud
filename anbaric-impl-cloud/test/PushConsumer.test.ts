import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createServer, Server} from "node:http";
import {AddressInfo} from "node:net";
import {QueueMessage} from "anbaric-tsapi";
import {PushConsumer} from "../src/PushConsumer";

const message = (jobId : string, workflowId : string = "workflow-1") : QueueMessage => ({ jobId, workflowId });

const startStubPlatform = (confirms : Array<QueueMessage>, registrations : Array<{ workflowId : string, url : string }>) : Promise<{ server : Server, baseUrl : string }> =>
    new Promise(resolve => {
        const server = createServer((request, response) => {
            const chunks : Array<Buffer> = [];
            request.on("data", chunk => chunks.push(chunk));
            request.on("end", () => {
                const body = () => JSON.parse(Buffer.concat(chunks).toString());
                if (request.method === "POST" && request.url === "/queue/confirm") {
                    confirms.push(body());
                    response.statusCode = 204;
                } else if (request.method === "POST" && request.url === "/consumers") {
                    registrations.push(body());
                    response.statusCode = 204;
                } else {
                    response.statusCode = 404;
                }
                response.end();
            });
        });
        server.listen(0, () => resolve({
            server,
            baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        }));
    });

describe("PushConsumer", () => {

    let confirms : Array<QueueMessage>;
    let registrations : Array<{ workflowId : string, url : string }>;
    let platform : Server;
    let consumer : PushConsumer;

    beforeEach(async () => {
        confirms = [];
        registrations = [];
        const stub = await startStubPlatform(confirms, registrations);
        platform = stub.server;
        consumer = new PushConsumer(stub.baseUrl, 0);
    });

    afterEach(async () => {
        await consumer.cleanUp();
        await new Promise<void>(resolve => platform.close(() => resolve()));
    });

    const listenerUrl = async () => {
        await vi.waitFor(() => expect(consumer.port).toBeDefined());
        return `http://127.0.0.1:${consumer.port}`;
    };

    const push = async (messages : Array<QueueMessage>) => {
        return fetch(`${await listenerUrl()}/process`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messages }),
        });
    };

    it("registers each subscription with the platform", async () => {
        consumer.subscribe("workflow-1", vi.fn(async () => {}));

        await vi.waitFor(() => expect(registrations).toEqual([
            { workflowId: "workflow-1", url: `http://localhost:${consumer.port}` },
        ]));
    });

    it("accepts pushed messages with a 202 listing the job ids", async () => {
        consumer.subscribe("workflow-1", vi.fn(async () => {}));

        const response = await push([message("job-1"), message("job-2")]);

        expect(response.status).toBe(202);
        expect(await response.json()).toEqual({ accepted: ["job-1", "job-2"] });
    });

    it("processes each message with its workflow's subscriber and confirms it", async () => {
        const processJob = vi.fn(async () => {});
        consumer.subscribe("workflow-1", processJob);

        await push([message("job-1"), message("job-2")]);

        await vi.waitFor(() => {
            expect(processJob).toHaveBeenCalledTimes(2);
            expect(confirms).toEqual([message("job-1"), message("job-2")]);
        });
    });

    it("does not confirm messages for unsubscribed workflows", async () => {
        const processJob = vi.fn(async () => {});
        consumer.subscribe("workflow-1", processJob);

        await push([message("job-1"), message("job-other", "workflow-2")]);

        await vi.waitFor(() => expect(confirms).toEqual([message("job-1")]));
        expect(processJob).toHaveBeenCalledExactlyOnceWith("job-1");
    });

    it("does not confirm a message whose processing fails", async () => {
        consumer.subscribe("workflow-1", vi.fn(async (jobId : string) => {
            if (jobId === "job-bad") throw new Error("processing failed");
        }));

        await push([message("job-bad"), message("job-good")]);

        await vi.waitFor(() => expect(confirms).toEqual([message("job-good")]));
    });

    it("rejects a malformed body with 400", async () => {
        consumer.subscribe("workflow-1", vi.fn(async () => {}));

        const response = await fetch(`${await listenerUrl()}/process`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ wrong: true }),
        });

        expect(response.status).toBe(400);
    });

    it("returns 404 for unknown routes", async () => {
        consumer.subscribe("workflow-1", vi.fn(async () => {}));

        const response = await fetch(`${await listenerUrl()}/unknown`);

        expect(response.status).toBe(404);
    });

    it("stops listening after cleanUp", async () => {
        consumer.subscribe("workflow-1", vi.fn(async () => {}));
        const url = await listenerUrl();

        await consumer.cleanUp();

        await expect(fetch(`${url}/process`, { method: "POST" })).rejects.toThrowError();
    });

});
