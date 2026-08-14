import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Action, Consumer, Job, JobPersistence, PropertyDefinition, Queue, State, Transition} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";
import {Code} from "../src/actors/Code";
import {Human} from "../src/actors/Human";
import {ConsumerFactory} from "../src/scheduling/ConsumerFactory";

const WORKFLOW_ID = "workflow-1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const mockPersistence = () => ({
    save: vi.fn(async (_job : Job) => {}),
    retrieve: vi.fn(async (_id : string) : Promise<Job> => {
        throw new Error("retrieve not mocked");
    }),
    delete: vi.fn(async (_id : string) => {}),
    list: vi.fn(async () => [] as Array<Job>),
    updateProperties: vi.fn(async (_id : string, _properties : Map<string, any>) => {}),
}) satisfies JobPersistence;

const mockQueue = () => ({
    enqueue: vi.fn(async (_jobId : string, _workflowId : string) => {}),
    schedule: vi.fn(async (_jobId : string, _workflowId : string, _due : Date) => {}),
}) satisfies Queue;

const mockConsumer = () => ({
    subscribe: vi.fn(),
    cleanUp: vi.fn(async () => {}),
}) satisfies Consumer;

const requiredNumber = (id : string) => {
    const definition = new PropertyDefinition(id);
    definition.required = true;
    definition.validation = (value) => typeof value === "number";
    return definition;
};

const stampingAction = (key : string, value : any, accepts : boolean = true) => {
    const action = new Action(key, new Code(key, async () => new Map([[key, value]])));
    action.predicate = () => accepts;
    return action;
};

describe("StateMachine", () => {

    let persistence : ReturnType<typeof mockPersistence>;
    let queue : ReturnType<typeof mockQueue>;
    let consumer : ReturnType<typeof mockConsumer>;

    beforeEach(() => {
        persistence = mockPersistence();
        queue = mockQueue();
        consumer = mockConsumer();
        vi.spyOn(ConsumerFactory, "instance").mockReturnValue(consumer);
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const machineWith = (states : Array<State>, schema : Array<PropertyDefinition> = []) =>
        new StateMachine(WORKFLOW_ID, states, "start", schema, persistence, queue);

    const progressJob = async (jobId : string) => {
        const processJob = consumer.subscribe.mock.calls[0][1];
        await processJob(jobId);
    };

    describe("construction", () => {

        it("subscribes to the consumer with its workflow id", () => {
            machineWith([new State("start")]);

            expect(consumer.subscribe).toHaveBeenCalledExactlyOnceWith(WORKFLOW_ID, expect.any(Function));
        });

        it("progresses a job when the consumer delivers its id", async () => {
            const job = new Job("job-1", new Map(), "start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [], [new Transition("done", () => true)]), new State("done")]);

            await progressJob("job-1");

            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
            expect(job.stateId).toBe("done");
        });

    });

    describe("cleanUp", () => {

        it("delegates to the consumer", async () => {
            const machine = machineWith([new State("start")]);

            await machine.cleanUp();

            expect(consumer.cleanUp).toHaveBeenCalledOnce();
        });

    });

    describe("startJob", () => {

        it("returns a job with a generated uuid in the start state", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob();

            expect(job.id).toMatch(UUID_PATTERN);
            expect(job.stateId).toBe("start");
        });

        it("stamps the new job with its workflow id", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob();

            expect(job.workflowId).toBe(WORKFLOW_ID);
        });

        it("marks the workflow as the starter by default", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob();

            expect(job.startedBy).toBe(WORKFLOW_ID);
        });

        it("marks the given actor as the starter", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob(undefined, new Human("chris", "admin"));

            expect(job.startedBy).toBe("chris");
        });

        it("persists the new job", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob();

            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
        });

        it("enqueues the new job id under its workflow", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob();

            expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith(job.id, WORKFLOW_ID);
        });

        it("keeps the given properties", async () => {
            const machine = machineWith([new State("start")], [new PropertyDefinition("colour")]);

            const job = await machine.startJob(new Map([["colour", "red"]]));

            expect(job.properties.get("colour")).toBe("red");
        });

        it("rejects a property that is not in the schema", async () => {
            const machine = machineWith([new State("start")]);

            await expect(machine.startJob(new Map([["unknown", 1]]))).rejects.toThrowError("Invalid properties");
        });

        it("rejects a missing required property without persisting or enqueueing", async () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.startJob()).rejects.toThrowError("Invalid properties");
            expect(persistence.save).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
        });

        it("rejects a property value that fails validation", async () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.startJob(new Map([["age", "old"]]))).rejects.toThrowError("Invalid properties");
            expect(persistence.save).not.toHaveBeenCalled();
        });

        it("accepts a valid required property", async () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            const job = await machine.startJob(new Map([["age", 42]]));

            expect(job.properties.get("age")).toBe(42);
            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
        });

    });

    describe("updateJob", () => {

        const actor = new Human("chris", "admin");

        it("updates the persisted properties and re-enqueues the job", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [new PropertyDefinition("colour")]);
            const update = new Map([["colour", "blue"]]);

            await machine.updateJob("job-1", update, actor);

            expect(persistence.updateProperties).toHaveBeenCalledExactlyOnceWith("job-1", update);
            expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith("job-1", WORKFLOW_ID);
        });

        it("does not demand required properties on update", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.updateJob("job-1", new Map([["age", 43]]), actor)).resolves.toBeUndefined();
        });

        it("rejects an invalid value without updating", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.updateJob("job-1", new Map([["age", "old"]]), actor)).rejects.toThrowError("Invalid properties");
            expect(persistence.updateProperties).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
        });

        it("propagates a retrieval failure for an unknown job", async () => {
            persistence.retrieve.mockImplementation(() => {
                throw new Error('No job found with id "missing"');
            });
            const machine = machineWith([new State("start")]);

            await expect(machine.updateJob("missing", new Map(), actor)).rejects.toThrowError('No job found with id "missing"');
        });

    });

    describe("progressJob", () => {

        const jobInState = (stateId : string) => new Job("job-1", new Map(), stateId);

        it("applies the properties returned by matching code actions", async () => {
            const job = jobInState("start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [
                stampingAction("first", true),
                stampingAction("skipped", true, false),
                stampingAction("second", true),
            ])], [new PropertyDefinition("first"), new PropertyDefinition("skipped"), new PropertyDefinition("second")]);

            await progressJob("job-1");

            expect(job.properties.get("first")).toBe(true);
            expect(job.properties.get("second")).toBe(true);
            expect(job.properties.has("skipped")).toBe(false);
        });

        it("leaves actions of other actor types untouched", async () => {
            const job = jobInState("start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [new Action("Approve", new Human("chris", "admin"))])]);

            await progressJob("job-1");

            expect(job.properties.size).toBe(0);
            expect(persistence.save).not.toHaveBeenCalled();
        });

        it("discards action properties that fail the schema", async () => {
            const job = jobInState("start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [stampingAction("unknown", true)])]);

            await progressJob("job-1");

            expect(job.properties.has("unknown")).toBe(false);
            expect(persistence.save).not.toHaveBeenCalled();
        });

        it("does not save or re-enqueue when nothing changed", async () => {
            const job = jobInState("start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start")]);

            await progressJob("job-1");

            expect(persistence.save).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
        });

        it("saves and re-enqueues when an action changed the job", async () => {
            const job = jobInState("start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [stampingAction("touched", true)])], [new PropertyDefinition("touched")]);

            await progressJob("job-1");

            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
            expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith("job-1", WORKFLOW_ID);
        });

        describe("transitions", () => {

            it("applies the first transition whose predicate matches", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([
                    new State("start", [], [
                        new Transition("rejected", () => false),
                        new Transition("approved", () => true),
                        new Transition("archived", () => true),
                    ]),
                    new State("rejected"), new State("approved"), new State("archived"),
                ]);

                await progressJob("job-1");

                expect(job.stateId).toBe("approved");
            });

            it("records the transition in the job's history", async () => {
                const job = new Job("job-1", new Map(), "start", WORKFLOW_ID);
                persistence.retrieve.mockResolvedValue(job);
                machineWith([new State("start", [], [new Transition("done", () => true)]), new State("done")]);

                await progressJob("job-1");

                expect(job.transitions).toEqual([{ from: "start", to: "done", actor: WORKFLOW_ID }]);
            });

            it("leaves the state unchanged when no transition matches", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([
                    new State("start", [], [new Transition("done", () => false)]),
                    new State("done"),
                ]);

                await progressJob("job-1");

                expect(job.stateId).toBe("start");
            });

            it("applies at most one transition per progression", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([
                    new State("start", [], [new Transition("middle", () => true)]),
                    new State("middle", [], [new Transition("done", () => true)]),
                ]);

                await progressJob("job-1");

                expect(job.stateId).toBe("middle");
            });

            it("evaluates transition predicates after the actions have run", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([
                    new State("start", [stampingAction("approved", true)], [
                        new Transition("done", (candidate) => candidate.properties.get("approved") === true),
                    ]),
                    new State("done"),
                ], [new PropertyDefinition("approved")]);

                await progressJob("job-1");

                expect(job.stateId).toBe("done");
            });

            it("skips transitions whose target state is not defined", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([
                    new State("start", [], [
                        new Transition("nowhere", () => true),
                        new Transition("done", () => true),
                    ]),
                    new State("done"),
                ]);

                await progressJob("job-1");

                expect(job.stateId).toBe("done");
            });

            it("saves and re-enqueues the job after transitioning", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([new State("start", [], [new Transition("done", () => true)]), new State("done")]);

                await progressJob("job-1");

                expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
                expect(persistence.save.mock.calls[0][0].stateId).toBe("done");
                expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith("job-1", WORKFLOW_ID);
            });

        });

    });

});
