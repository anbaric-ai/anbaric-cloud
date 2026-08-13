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

    it("startJob persists a retrievable job and queues it", () => {
        const job = machine.startJob(new Map([["age", 42]]));

        expect(persistence.retrieve(job.id)).toBe(job);
        expect(queue.dequeueSome()).toEqual([job.id]);
    });

    it("updateJob merges into the persisted job and re-queues it", () => {
        const job = machine.startJob(new Map([["age", 42]]));
        queue.dequeueSome();

        machine.updateJob(job.id, new Map([["age", 43]]));

        expect(persistence.retrieve(job.id).properties.get("age")).toBe(43);
        expect(queue.dequeueSome()).toEqual([job.id]);
    });

    it("progressJob runs the current state's actions against the persisted job", () => {
        const job = machine.startJob();

        machine.progressJob(job.id);

        expect(persistence.retrieve(job.id).properties.get("progressed")).toBe(true);
    });

    it("a rejected startJob leaves persistence and queue untouched", () => {
        expect(() => machine.startJob(new Map([["age", "old"]]))).toThrowError();

        expect(persistence.list()).toEqual([]);
        expect(queue.dequeueSome()).toEqual([]);
    });

    it("runs a job through multiple states as it is progressed", () => {
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

        const job = workflow.startJob();
        expect(job.stateId).toBe("draft");

        workflow.progressJob(job.id);
        expect(persistence.retrieve(job.id).stateId).toBe("review");

        workflow.progressJob(job.id);
        const finished = persistence.retrieve(job.id);
        expect(finished.stateId).toBe("done");
        expect(finished.properties.get("drafted")).toBe(true);
        expect(finished.properties.get("reviewed")).toBe(true);

        workflow.progressJob(job.id);
        expect(persistence.retrieve(job.id).stateId).toBe("done");
    });

    it("a rejected updateJob leaves the job untouched", () => {
        const job = machine.startJob(new Map([["age", 42]]));
        queue.dequeueSome();

        expect(() => machine.updateJob(job.id, new Map([["age", "old"]]))).toThrowError();

        expect(persistence.retrieve(job.id).properties.get("age")).toBe(42);
        expect(queue.dequeueSome()).toEqual([]);
    });

});
