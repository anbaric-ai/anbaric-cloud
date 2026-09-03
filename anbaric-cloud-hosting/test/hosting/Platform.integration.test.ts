import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Action, PropertyDefinition, QueueMessage, State, Transition} from "anbaric-tsapi";
import {CloudJobPersistence, CloudQueue} from "anbaric-impl-cloud";
import {Code, Human, InMemoryJobPersistence, StateMachine} from "anbaric-state-machine";
import {RemoteQueue} from "../../src/queuing/RemoteQueue";
import {ConsumerRegistry} from "../../src/queuing/ConsumerRegistry";
import {Dispatcher} from "../../src/queuing/Dispatcher";
import {HostingServer} from "../../src/hosting/HostingServer";

const LEASE_MS = 30_000;

/* Mirrors PostgresQueue's semantics: dequeueSome leases rows but leaves them in
   place until confirmed, and confirm removes exactly the delivered row by its
   position. A confirm keyed on jobId/workflowId instead would also drop the
   next-hop row enqueued during processing - the P0 multi-hop stall. */
class ConfirmableInMemoryQueue implements RemoteQueue {

    private rows : Array<{ position : number, message : QueueMessage, due? : Date, leasedUntil? : number }> = [];
    private nextPosition = 1;
    confirmed : Array<QueueMessage> = [];

    async enqueue(jobId : string, appId : string | undefined, workflowId : string) : Promise<void> {
        this.rows.push({ position: this.nextPosition++, message: { jobId, appId, workflowId } });
    }

    async schedule(jobId : string, appId : string | undefined, workflowId : string, due : Date) : Promise<void> {
        this.rows.push({ position: this.nextPosition++, message: { jobId, appId, workflowId }, due });
    }

    async dequeueSome() : Promise<Array<QueueMessage>> {
        const now = Date.now();
        const available = this.rows.filter(row =>
            (!row.due || row.due.getTime() <= now) && (!row.leasedUntil || row.leasedUntil <= now));
        for (const row of available) row.leasedUntil = now + LEASE_MS;
        return available.map(row => ({ ...row.message, position: row.position }));
    }

    async confirm(message : QueueMessage) : Promise<void> {
        this.confirmed.push(message);
        this.rows = this.rows.filter(row => row.position !== message.position);
    }

    async cancel(_message : QueueMessage) : Promise<void> {
    }

    async size() : Promise<number> {
        return this.rows.length;
    }

}

const stampingAction = (key : string) => {
    const action = new Action(key, new Code(key));
    action.run = async () => new Map([[key, true]]);
    return action;
};

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
    let baseUrl : string;

    beforeEach(async () => {
        backingQueue = new ConfirmableInMemoryQueue();
        const registry = new ConsumerRegistry();
        server = new HostingServer(new InMemoryJobPersistence(), backingQueue, registry);
        const port = await server.listen(0);
        baseUrl = `http://127.0.0.1:${port}`;

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
            const progressed = await persistence.retrieve(job.id, new Code("e2e"));
            expect(progressed.properties.get("progressed")).toBe(true);
            expect(progressed.state).toBe("done");
        }, { timeout: 2000 });

        await vi.waitFor(() => expect(backingQueue.confirmed).toContainEqual(
            expect.objectContaining({ jobId: job.id, workflowId: "workflow-e2e" }),
        ), { timeout: 2000 });
    });

    it("delivers an updated job back through the dispatch loop", async () => {
        const job = await machine.startJob();
        await vi.waitFor(() => expect(backingQueue.confirmed.length).toBe(2), { timeout: 2000 });

        await machine.updateJob(job.id, new Map(), new Human("chris", "admin"));

        await vi.waitFor(() => expect(backingQueue.confirmed.length).toBe(3), { timeout: 2000 });
    });

    it("chains a job across multiple states with no external kick", async () => {
        const pipeline = new StateMachine(
            "workflow-multihop",
            [
                new State("a", [stampingAction("stampedA")], [new Transition("b", (job) => job.properties.get("stampedA") === true)]),
                new State("b", [stampingAction("stampedB")], [new Transition("c", (job) => job.properties.get("stampedB") === true)]),
                new State("c"),
            ],
            "a",
            [optionalFlag("stampedA"), optionalFlag("stampedB")],
            persistence,
            new CloudQueue(baseUrl),
        );

        try {
            const job = await pipeline.startJob();

            await vi.waitFor(async () => {
                const progressed = await persistence.retrieve(job.id, new Code("e2e"));
                expect(progressed.state).toBe("c");
                expect(progressed.properties.get("stampedA")).toBe(true);
                expect(progressed.properties.get("stampedB")).toBe(true);
            }, { timeout: 3000 });
        } finally {
            await pipeline.cleanUp();
        }
    });

});
