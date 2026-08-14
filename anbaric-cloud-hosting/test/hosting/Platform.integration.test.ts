import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Action, PropertyDefinition, QueueMessage, State, Transition} from "anbaric-tsapi";
import {CloudJobPersistence, CloudQueue} from "anbaric-cloud";
import {Code, Human, InMemoryJobPersistence, InMemoryQueue, StateMachine} from "anbaric-state-machine";
import {ConfirmableQueue} from "../../src/queuing/ConfirmableQueue";
import {ConsumerRegistry} from "../../src/queuing/ConsumerRegistry";
import {Dispatcher} from "../../src/queuing/Dispatcher";
import {HostingServer} from "../../src/hosting/HostingServer";

class ConfirmableInMemoryQueue extends InMemoryQueue implements ConfirmableQueue {

    confirmed : Array<QueueMessage> = [];

    async confirm(message : QueueMessage) : Promise<void> {
        this.confirmed.push(message);
    }

}

const stampingAction = (key : string) =>
    new Action(key, new Code(key, async () => new Map([[key, true]])));

const optionalFlag = (id : string) => {
    const definition = new PropertyDefinition(id);
    definition.validation = (value) => typeof value === "boolean";
    return definition;
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

        process.env.ANBARIC_CLOUD_URL = baseUrl;
        process.env.ANBARIC_CONSUMER_PORT = "0";

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
            [optionalFlag("progressed")],
            persistence,
            new CloudQueue(baseUrl),
        );
    });

    afterEach(async () => {
        delete process.env.ANBARIC_CLOUD_URL;
        delete process.env.ANBARIC_CONSUMER_PORT;
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

        await vi.waitFor(() => expect(backingQueue.confirmed).toContainEqual(
            { jobId: job.id, workflowId: "workflow-e2e" },
        ), { timeout: 2000 });
    });

    it("delivers an updated job back through the dispatch loop", async () => {
        const job = await machine.startJob();
        await vi.waitFor(() => expect(backingQueue.confirmed.length).toBe(2), { timeout: 2000 });

        await machine.updateJob(job.id, new Map(), new Human("chris", "admin"));

        await vi.waitFor(() => expect(backingQueue.confirmed.length).toBe(3), { timeout: 2000 });
    });

});
