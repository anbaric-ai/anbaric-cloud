import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {Job, JsonStore, QueueMessage} from "anbaric-tsapi";
import {CloudJobPersistence, CloudJsonStore, CloudQueue, CloudSecretStore} from "anbaric-cloud";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
import {InMemoryJsonStore, InMemorySecretStore} from "anbaric-data-store";
import {ConfirmableQueue} from "../src/ConfirmableQueue";
import {HostingServer} from "../src/HostingServer";

const makeJob = (id : string, properties : Map<string, any> = new Map()) => new Job(id, properties, "start");

class ConfirmableInMemoryQueue extends InMemoryQueue implements ConfirmableQueue {

    confirmed : Array<QueueMessage> = [];

    async confirm(message : QueueMessage) : Promise<void> {
        this.confirmed.push(message);
    }

}

describe("HostingServer round-trip via the cloud clients", () => {

    let server : HostingServer;
    let baseUrl : string;
    let persistence : CloudJobPersistence;
    let queue : CloudQueue;
    let backingQueue : ConfirmableInMemoryQueue;

    beforeEach(async () => {
        backingQueue = new ConfirmableInMemoryQueue();
        const documentStores = new Map<string, JsonStore>();
        server = new HostingServer(new InMemoryJobPersistence(), backingQueue, undefined, undefined,
            (collection) => {
                if (!documentStores.has(collection)) documentStores.set(collection, new InMemoryJsonStore());
                return documentStores.get(collection)!;
            },
            new InMemorySecretStore());
        const port = await server.listen(0);
        baseUrl = `http://127.0.0.1:${port}`;
        persistence = new CloudJobPersistence(baseUrl);
        queue = new CloudQueue(baseUrl);
    });

    afterEach(async () => {
        await server.close();
    });

    describe("job persistence", () => {

        it("saves and retrieves a job", async () => {
            await persistence.save(makeJob("job-1", new Map([["colour", "red"]])));

            const retrieved = await persistence.retrieve("job-1");

            expect(retrieved.id).toBe("job-1");
            expect(retrieved.stateId).toBe("start");
            expect(retrieved.properties.get("colour")).toBe("red");
        });

        it("rejects retrieval of an unknown job", async () => {
            await expect(persistence.retrieve("missing")).rejects.toThrowError('No job found with id "missing"');
        });

        it("updates properties by merging", async () => {
            await persistence.save(makeJob("job-1", new Map([["colour", "red"]])));

            await persistence.updateProperties("job-1", new Map([["size", "large"]]));

            const updated = await persistence.retrieve("job-1");
            expect(updated.properties.get("colour")).toBe("red");
            expect(updated.properties.get("size")).toBe("large");
        });

        it("deletes a job", async () => {
            await persistence.save(makeJob("job-1"));

            await persistence.delete("job-1");

            await expect(persistence.retrieve("job-1")).rejects.toThrowError();
        });

        it("lists jobs with paging", async () => {
            for (const id of ["a", "b", "c"]) {
                await persistence.save(makeJob(id));
            }

            expect((await persistence.list()).map(job => job.id)).toEqual(["a", "b", "c"]);
            expect((await persistence.list(2, 1)).map(job => job.id)).toEqual(["c"]);
        });

    });

    describe("queue", () => {

        it("enqueues and dequeues messages in order", async () => {
            await queue.enqueue("job-1", "workflow-1");
            await queue.enqueue("job-2", "workflow-2");

            expect(await queue.dequeueSome()).toEqual([
                { jobId: "job-1", workflowId: "workflow-1" },
                { jobId: "job-2", workflowId: "workflow-2" },
            ]);
            expect(await queue.dequeueSome()).toEqual([]);
        });

        it("releases past-due scheduled messages and holds future ones", async () => {
            await queue.schedule("past-due", "workflow-1", new Date(Date.now() - 1000));
            await queue.schedule("future", "workflow-1", new Date(Date.now() + 60_000));

            expect(await queue.dequeueSome()).toEqual([{ jobId: "past-due", workflowId: "workflow-1" }]);
        });

        it("passes confirm messages through to the backing queue", async () => {
            const response = await fetch(`${baseUrl}/queue/confirm`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ jobId: "job-1", workflowId: "workflow-1" }),
            });

            expect(response.status).toBe(204);
            expect(backingQueue.confirmed).toEqual([{ jobId: "job-1", workflowId: "workflow-1" }]);
        });

    });

    describe("json documents", () => {

        const customerSchema = {
            type: "object" as const,
            required: ["name"],
            properties: { name: { type: "string" as const } },
        };

        it("round-trips documents through the cloud store", async () => {
            const store = new CloudJsonStore("customers", customerSchema, baseUrl);

            await store.save("ada", { name: "Ada" });

            expect(await store.retrieve("ada")).toEqual({ name: "Ada" });
        });

        it("rejects an invalid document client-side before it reaches the platform", async () => {
            const store = new CloudJsonStore("customers", customerSchema, baseUrl);

            await expect(store.save("bad", { name: 7 })).rejects.toThrowError("failed schema validation");
            expect(await store.list()).toEqual([]);
        });

        it("keeps collections separate", async () => {
            const customers = new CloudJsonStore("customers", customerSchema, baseUrl);
            const orders = new CloudJsonStore("orders", undefined, baseUrl);

            await customers.save("ada", { name: "Ada" });
            await orders.save("order-1", { total: 42 });

            expect(await customers.list()).toEqual([{ name: "Ada" }]);
            expect(await orders.list()).toEqual([{ total: 42 }]);
        });

        it("deletes documents and 404s unknown ids", async () => {
            const store = new CloudJsonStore("customers", customerSchema, baseUrl);
            await store.save("ada", { name: "Ada" });

            await store.delete("ada");

            await expect(store.retrieve("ada")).rejects.toThrowError('No document found with id "ada"');
        });

    });

    describe("secrets", () => {

        it("round-trips a secret through the cloud store", async () => {
            const secrets = new CloudSecretStore(baseUrl);

            await secrets.save("api-key", "s3cr3t");

            expect(await secrets.retrieve("api-key")).toBe("s3cr3t");
        });

        it("lists secret names", async () => {
            const secrets = new CloudSecretStore(baseUrl);

            await secrets.save("api-key", "a");
            await secrets.save("db-password", "b");

            expect(await secrets.list()).toEqual(["api-key", "db-password"]);
        });

        it("deletes secrets and 404s unknown names", async () => {
            const secrets = new CloudSecretStore(baseUrl);
            await secrets.save("api-key", "s3cr3t");

            await secrets.delete("api-key");

            await expect(secrets.retrieve("api-key")).rejects.toThrowError('No secret found with name "api-key"');
        });

        it("rejects a non-string secret value", async () => {
            const response = await fetch(`${baseUrl}/secrets/api-key`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ value: 42 }),
            });

            expect(response.status).toBe(400);
        });

    });

    it("lists registered state machines", async () => {
        await fetch(`${baseUrl}/consumers`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workflowId: "workflow-1", url: "http://app:8788" }),
        });

        const stateMachines = await (await fetch(`${baseUrl}/state-machines`)).json();

        expect(stateMachines).toEqual([{ workflowId: "workflow-1", url: "http://app:8788" }]);
    });

    it("answers pings", async () => {
        const response = await fetch(`${baseUrl}/ping`);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ status: "ok" });
    });

    it("returns 404 for unknown routes", async () => {
        const response = await fetch(`${baseUrl}/unknown`);

        expect(response.status).toBe(404);
    });

});
