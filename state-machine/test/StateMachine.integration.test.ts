import {beforeEach, describe, expect, it, vi} from "vitest";
import {Action, Consumer, Job, PropertyDefinition, State, Transition} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";
import {LocalConsumer} from "../src/scheduling/LocalConsumer";
import {DefaultActionResolver} from "../src/actions/DefaultActionResolver";

const idleConsumer = () : Consumer => ({
    subscribe: () => {},
    cleanUp: async () => {},
});

const stampingAction = (key : string, value : any) => {
    const action = new Action();
    action.run = (job) => {
        job.properties.set(key, value);
        return job;
    };
    return action;
};

const optionalNumber = (id : string) => {
    const definition = new PropertyDefinition(id);
    definition.validation = (value) => typeof value === "number";
    return definition;
};

describe("StateMachine with in-memory collaborators", () => {

    let persistence : InMemoryJobPersistence;
    let queue : InMemoryQueue;
    let machine : StateMachine;

    beforeEach(() => {
        persistence = new InMemoryJobPersistence();
        queue = new InMemoryQueue();
        machine = new StateMachine(
            "workflow-1",
            [new State("start", [stampingAction("progressed", true)])],
            "start",
            [optionalNumber("age")],
            new DefaultActionResolver(),
            persistence,
            queue,
            idleConsumer(),
        );
    });

    it("startJob persists a retrievable job and queues it under the workflow", async () => {
        const job = await machine.startJob(new Map([["age", 42]]));

        expect(await persistence.retrieve(job.id)).toBe(job);
        expect(await queue.dequeueSome()).toEqual([{ jobId: job.id, workflowId: "workflow-1" }]);
    });

    it("updateJob merges into the persisted job and re-queues it", async () => {
        const job = await machine.startJob(new Map([["age", 42]]));
        await queue.dequeueSome();

        await machine.updateJob(job.id, new Map([["age", 43]]));

        expect((await persistence.retrieve(job.id)).properties.get("age")).toBe(43);
        expect(await queue.dequeueSome()).toEqual([{ jobId: job.id, workflowId: "workflow-1" }]);
    });

    it("progressJob runs the current state's actions against the persisted job", async () => {
        const job = await machine.startJob();

        await machine.progressJob(job.id);

        expect((await persistence.retrieve(job.id)).properties.get("progressed")).toBe(true);
    });

    it("a local consumer progresses started jobs without manual intervention", async () => {
        const consumer = new LocalConsumer(queue, 10);
        const automatic = new StateMachine(
            "workflow-auto",
            [
                new State("start", [stampingAction("progressed", true)], [new Transition("done", () => true)]),
                new State("done"),
            ],
            "start",
            [],
            new DefaultActionResolver(),
            persistence,
            queue,
            consumer,
        );

        const job = await automatic.startJob();

        await vi.waitFor(async () => {
            const progressed = await persistence.retrieve(job.id);
            expect(progressed.properties.get("progressed")).toBe(true);
            expect(progressed.stateId).toBe("done");
        });

        await automatic.cleanUp();
    });

    it("runs a job through multiple states as it is progressed", async () => {
        const stamped = (key : string) => (job : Job) => job.properties.get(key) === true;
        const workflow = new StateMachine(
            "workflow-multi",
            [
                new State("draft", [stampingAction("drafted", true)], [new Transition("review", stamped("drafted"))]),
                new State("review", [stampingAction("reviewed", true)], [new Transition("done", stamped("reviewed"))]),
                new State("done"),
            ],
            "draft",
            [],
            new DefaultActionResolver(),
            persistence,
            queue,
            idleConsumer(),
        );

        const job = await workflow.startJob();
        expect(job.stateId).toBe("draft");

        await workflow.progressJob(job.id);
        expect((await persistence.retrieve(job.id)).stateId).toBe("review");

        await workflow.progressJob(job.id);
        const finished = await persistence.retrieve(job.id);
        expect(finished.stateId).toBe("done");
        expect(finished.properties.get("drafted")).toBe(true);
        expect(finished.properties.get("reviewed")).toBe(true);

        await workflow.progressJob(job.id);
        expect((await persistence.retrieve(job.id)).stateId).toBe("done");
    });

    it("a rejected startJob leaves persistence and queue untouched", async () => {
        await expect(machine.startJob(new Map([["age", "old"]]))).rejects.toThrowError();

        expect(await persistence.list()).toEqual([]);
        expect(await queue.dequeueSome()).toEqual([]);
    });

    it("a rejected updateJob leaves the job untouched", async () => {
        const job = await machine.startJob(new Map([["age", 42]]));
        await queue.dequeueSome();

        await expect(machine.updateJob(job.id, new Map([["age", "old"]]))).rejects.toThrowError();

        expect((await persistence.retrieve(job.id)).properties.get("age")).toBe(42);
        expect(await queue.dequeueSome()).toEqual([]);
    });

});
