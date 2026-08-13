import {beforeEach, describe, expect, it} from "vitest";
import {Action, Job, PropertyDefinition, State, Transition} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";
import {DefaultActionResolver} from "../src/actions/DefaultActionResolver";

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
            [new State("start", [stampingAction("progressed", true)])],
            "start",
            [optionalNumber("age")],
            new DefaultActionResolver(),
            persistence,
            queue,
        );
    });

    it("startJob persists a retrievable job and queues it", async () => {
        const job = await machine.startJob(new Map([["age", 42]]));

        expect(await persistence.retrieve(job.id)).toBe(job);
        expect(await queue.dequeueSome()).toEqual([job.id]);
    });

    it("updateJob merges into the persisted job and re-queues it", async () => {
        const job = await machine.startJob(new Map([["age", 42]]));
        await queue.dequeueSome();

        await machine.updateJob(job.id, new Map([["age", 43]]));

        expect((await persistence.retrieve(job.id)).properties.get("age")).toBe(43);
        expect(await queue.dequeueSome()).toEqual([job.id]);
    });

    it("progressJob runs the current state's actions against the persisted job", async () => {
        const job = await machine.startJob();

        await machine.progressJob(job.id);

        expect((await persistence.retrieve(job.id)).properties.get("progressed")).toBe(true);
    });

    it("runs a job through multiple states as it is progressed", async () => {
        const stamped = (key : string) => (job : Job) => job.properties.get(key) === true;
        const workflow = new StateMachine(
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
