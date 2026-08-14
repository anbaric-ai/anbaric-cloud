import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Action, Consumer, Dequeue, Job, PropertyDefinition, State, Transition} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";
import {Code} from "../src/actors/Code";
import {Human} from "../src/actors/Human";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";
import {PullConsumer} from "../src/scheduling/PullConsumer";
import {ConsumerFactory} from "../src/scheduling/ConsumerFactory";

const stampingAction = (key : string, value : any) => {
    const action = new Action(key, new Code(key));
    action.run = async () => new Map([[key, value]]);
    return action;
};

const optionalNumber = (id : string) => {
    const definition = new PropertyDefinition(id);
    definition.validation = (value) => typeof value === "number";
    return definition;
};

const optionalFlag = (id : string) => {
    const definition = new PropertyDefinition(id);
    definition.validation = (value) => typeof value === "boolean";
    return definition;
};

describe("StateMachine with in-memory collaborators", () => {

    let persistence : InMemoryJobPersistence;
    let queue : InMemoryQueue;
    let machine : StateMachine;
    let progress : (jobId : string) => Promise<void>;

    const capturingConsumer = () : Consumer => ({
        subscribe: (_workflowId, processJob) => {
            progress = processJob;
        },
        cleanUp: async () => {},
    });

    beforeEach(() => {
        persistence = new InMemoryJobPersistence();
        queue = new InMemoryQueue();
        vi.spyOn(ConsumerFactory, "instance").mockImplementation(() => capturingConsumer());
        vi.spyOn(console, "log").mockImplementation(() => {});
        machine = new StateMachine(
            "workflow-1",
            [new State("start", [stampingAction("progressed", true)])],
            "start",
            [optionalNumber("age"), optionalFlag("progressed")],
            persistence,
            queue,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("startJob persists a retrievable job and queues it under the workflow", async () => {
        const job = await machine.startJob(new Map([["age", 42]]));

        expect(await persistence.retrieve(job.id)).toBe(job);
        expect(await queue.dequeueSome()).toEqual([{ jobId: job.id, workflowId: "workflow-1" }]);
    });

    it("updateJob merges into the persisted job and re-queues it", async () => {
        const job = await machine.startJob(new Map([["age", 42]]));
        await queue.dequeueSome();

        await machine.updateJob(job.id, new Map([["age", 43]]), new Human("chris", "admin"));

        expect((await persistence.retrieve(job.id)).properties.get("age")).toBe(43);
        expect(await queue.dequeueSome()).toEqual([{ jobId: job.id, workflowId: "workflow-1" }]);
    });

    it("progressing a job runs the current state's actions against it", async () => {
        const job = await machine.startJob();

        await progress(job.id);

        expect((await persistence.retrieve(job.id)).properties.get("progressed")).toBe(true);
    });

    it("a pull consumer progresses started jobs without manual intervention", async () => {
        vi.mocked(ConsumerFactory.instance).mockImplementation(consumedQueue =>
            Dequeue.supports(consumedQueue) ? new PullConsumer(consumedQueue, 10) : capturingConsumer());
        const automatic = new StateMachine(
            "workflow-auto",
            [
                new State("start", [stampingAction("progressed", true)], [new Transition("done", () => true)]),
                new State("done"),
            ],
            "start",
            [optionalFlag("progressed")],
            persistence,
            queue,
        );

        const job = await automatic.startJob();

        await vi.waitFor(async () => {
            const progressed = await persistence.retrieve(job.id);
            expect(progressed.properties.get("progressed")).toBe(true);
            expect(progressed.stateId).toBe("done");
        });

        await automatic.cleanUp();
    });

    it("runs a job through multiple states and records its history", async () => {
        const stamped = (key : string) => (job : Job) => job.properties.get(key) === true;
        const workflow = new StateMachine(
            "workflow-multi",
            [
                new State("draft", [stampingAction("drafted", true)], [new Transition("review", stamped("drafted"))]),
                new State("review", [stampingAction("reviewed", true)], [new Transition("done", stamped("reviewed"))]),
                new State("done"),
            ],
            "draft",
            [optionalFlag("drafted"), optionalFlag("reviewed")],
            persistence,
            queue,
        );

        const job = await workflow.startJob();
        expect(job.stateId).toBe("draft");

        await progress(job.id);
        expect((await persistence.retrieve(job.id)).stateId).toBe("review");

        await progress(job.id);
        const finished = await persistence.retrieve(job.id);
        expect(finished.stateId).toBe("done");
        expect(finished.properties.get("drafted")).toBe(true);
        expect(finished.properties.get("reviewed")).toBe(true);
        expect(finished.transitions).toEqual([
            { from: "draft", to: "review", actor: "workflow-multi" },
            { from: "review", to: "done", actor: "workflow-multi" },
        ]);

        await progress(job.id);
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

        await expect(machine.updateJob(job.id, new Map([["age", "old"]]), new Human("chris", "admin"))).rejects.toThrowError();

        expect((await persistence.retrieve(job.id)).properties.get("age")).toBe(42);
        expect(await queue.dequeueSome()).toEqual([]);
    });

});
