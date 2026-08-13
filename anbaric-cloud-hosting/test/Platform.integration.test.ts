import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Action, QueueMessage, State, Transition} from "anbaric-tsapi";
import {CloudConsumer, CloudJobPersistence, CloudQueue} from "anbaric-cloud";
import {DefaultActionResolver, InMemoryJobPersistence, InMemoryQueue, StateMachine} from "anbaric-state-machine";
import {ConfirmableQueue} from "../src/ConfirmableQueue";
import {ConsumerRegistry} from "../src/ConsumerRegistry";
import {Dispatcher} from "../src/Dispatcher";
import {HostingServer} from "../src/HostingServer";

class ConfirmableInMemoryQueue extends InMemoryQueue implements ConfirmableQueue {

    confirmed : Array<QueueMessage> = [];

    async confirm(message : QueueMessage) : Promise<void> {
        this.confirmed.push(message);
    }

}

const stampingAction = (key : string) => {
    const action = new Action();
    action.run = (job) => {
        job.properties.set(key, true);
        return job;
    };
    return action;
};

describe("platform end to end", () => {

    let backingQueue : ConfirmableInMemoryQueue;
    let server : HostingServer;
    let dispatcher : Dispatcher;
    let machine : StateMachine;
    let persistence : CloudJobPersistence;

    beforeEach(async () => {
        backingQueue = new ConfirmableInMemoryQueue();
        const registry = new ConsumerRegistry();
        server = new HostingServer(new InMemoryJobPersistence(), backingQueue, registry);
        const port = await server.listen(0);
        const baseUrl = `http://127.0.0.1:${port}`;

        dispatcher = new Dispatcher(backingQueue, registry, 10);
        dispatcher.start();

        persistence = new CloudJobPersistence(baseUrl);
        machine = new StateMachine(
            "workflow-e2e",
            [
                new State("start", [stampingAction("progressed")], [new Transition("done", () => true)]),
                new State("done"),
            ],
            "start",
            [],
            new DefaultActionResolver(),
            persistence,
            new CloudQueue(baseUrl),
            new CloudConsumer(baseUrl, 0),
        );
    });

    afterEach(async () => {
        await machine.cleanUp();
        await dispatcher.cleanUp();
        await server.close();
    });

    it("progresses a started job through platform dispatch and confirms it", async () => {
        const job = await machine.startJob();

        await vi.waitFor(async () => {
            const progressed = await persistence.retrieve(job.id);
            expect(progressed.properties.get("progressed")).toBe(true);
            expect(progressed.stateId).toBe("done");
        }, { timeout: 2000 });

        await vi.waitFor(() => expect(backingQueue.confirmed).toEqual([
            { jobId: job.id, workflowId: "workflow-e2e" },
        ]), { timeout: 2000 });
    });

    it("delivers an updated job back through the dispatch loop", async () => {
        const job = await machine.startJob();
        await vi.waitFor(() => expect(backingQueue.confirmed.length).toBe(1), { timeout: 2000 });

        await machine.updateJob(job.id, new Map());

        await vi.waitFor(() => expect(backingQueue.confirmed.length).toBe(2), { timeout: 2000 });
    });

});
