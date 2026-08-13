import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {Job, QueueMessage} from "anbaric-tsapi";
import {CloudJobPersistence, CloudQueue} from "anbaric-cloud";
import {InMemoryJobPersistence, InMemoryQueue} from "anbaric-state-machine";
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
        server = new HostingServer(new InMemoryJobPersistence(), backingQueue);
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

    it("returns 404 for unknown routes", async () => {
        const response = await fetch(`${baseUrl}/unknown`);

        expect(response.status).toBe(404);
    });

});
