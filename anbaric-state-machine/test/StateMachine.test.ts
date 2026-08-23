import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Action, Actor, Auditor, Consumer, Job, JobPersistence, PropertyDefinition, Queue, State, Terminal, Transition} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";
import {Code} from "../src/actors/Code";
import {Human} from "../src/actors/Human";
import {ConsumerFactory} from "../src/scheduling/ConsumerFactory";

const WORKFLOW_ID = "workflow-1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const mockPersistence = () => ({
    create: vi.fn(async (_actor : Actor, _job : Job) => {}),
    save: vi.fn(async (_actor : Actor, _description : string, _job : Job,
                       _properties? : Map<string, any>, _state? : string) => {}),
    retrieve: vi.fn(async (_id : string, _actor : Actor) : Promise<Job> => {
        throw new Error("retrieve not mocked");
    }),
    delete: vi.fn(async (_id : string, _actor : Actor) => {}),
    list: vi.fn(async (_actor : Actor) => [] as Array<Job>),
});

const mockQueue = () => ({
    enqueue: vi.fn(async (_jobId : string, _workflowId : string) => {}),
    schedule: vi.fn(async (_jobId : string, _workflowId : string, _due : Date) => {}),
}) satisfies Queue;

const mockConsumer = () => ({
    subscribe: vi.fn(),
    cleanUp: vi.fn(async () => {}),
}) satisfies Consumer;

const mockAuditor = () => ({
    audit: vi.fn(async (_resourceType : string, _resourceId : string, _actor : Actor,
                        _interaction : Array<string>, _description : string, _details : any) => {}),
}) satisfies Auditor;

const requiredNumber = (id : string) => {
    const definition = new PropertyDefinition(id);
    definition.required = true;
    definition.validation = (value) => typeof value === "number";
    return definition;
};

const stampingAction = (key : string, value : any, accepts : boolean = true) => {
    const action = new Action(key, new Code(key));
    action.predicate = () => accepts;
    action.run = async () => new Map([[key, value]]);
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
        new StateMachine(WORKFLOW_ID, states, "start", schema, persistence as unknown as JobPersistence, queue);

    const createdJob = () => persistence.create.mock.calls[0][1];
    const savedProperties = () => persistence.save.mock.calls[0][3];
    const savedState = () => persistence.save.mock.calls[0][4];

    const progressJob = async (jobId : string) => {
        const processJob = consumer.subscribe.mock.calls[0][1];
        await processJob(jobId);
    };

    describe("construction", () => {

        it("subscribes to the consumer with its workflow id", () => {
            machineWith([new State("start")]);

            expect(consumer.subscribe).toHaveBeenCalledExactlyOnceWith(WORKFLOW_ID, expect.any(Function));
        });

        it("audits its graph with the system actor on initialisation", () => {
            const auditor = mockAuditor();
            const review = new Action("review", new Human("ada", "admin"));
            review.description = "Ada reviews the submission";
            const states = [
                new State("start", [review], [new Transition("done", () => true)]),
                new Terminal("done", Terminal.Outcome.SUCCESS),
            ];

            new StateMachine(WORKFLOW_ID, states, "start", [requiredNumber("score")],
                persistence as unknown as JobPersistence, queue, 5 * 60_000, auditor);

            expect(auditor.audit).toHaveBeenCalledOnce();
            const [resourceType, resourceId, actor, interaction, , details] = auditor.audit.mock.calls[0];
            expect(resourceType).toBe("state-machine");
            expect(resourceId).toBe(WORKFLOW_ID);
            expect(actor.type).toBe("SYSTEM");
            expect(interaction).toEqual(["INITIALIZE"]);
            expect(details.startState).toBe("start");
            expect(details.dataSchema).toEqual([{ id: "score", required: true }]);
            expect(details.states.map((state : any) => state.id)).toEqual(["start", "done"]);
            expect(details.states[1].isTerminal).toBe(true);
            expect(details.states[0].actions).toEqual([
                { name: "review", description: "Ada reviews the submission",
                  actor: { id: "ada", type: "HUMAN", role: "admin" } },
            ]);
        });

        it("namespaces the workflow id by the app id when deployed", () => {
            const auditor = mockAuditor();
            process.env.ANBARIC_APP_ID = "my-app";
            try {
                const machine = new StateMachine(WORKFLOW_ID, [new State("start")], "start", [],
                    persistence as unknown as JobPersistence, queue, 5 * 60_000, auditor);

                expect(machine.workflowId).toBe("my-app/workflow-1");
                expect(consumer.subscribe).toHaveBeenCalledWith("my-app/workflow-1", expect.any(Function));
                expect(auditor.audit.mock.calls[0][1]).toBe("my-app/workflow-1");
            } finally {
                delete process.env.ANBARIC_APP_ID;
            }
        });

        it("progresses a job when the consumer delivers its id", async () => {
            const job = new Job("job-1", new Map(), "start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [], [new Transition("done", () => true)]), new State("done")]);

            await progressJob("job-1");

            expect(persistence.save).toHaveBeenCalledOnce();
            expect(savedState()).toBe("done");
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
            expect(job.state).toBe("start");
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

        it("creates the new job", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob();

            expect(persistence.create).toHaveBeenCalledOnce();
            expect(createdJob()).toBe(job);
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
            expect(persistence.create).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
        });

        it("rejects a property value that fails validation", async () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.startJob(new Map([["age", "old"]]))).rejects.toThrowError("Invalid properties");
            expect(persistence.create).not.toHaveBeenCalled();
        });

        it("accepts a valid required property", async () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            const job = await machine.startJob(new Map([["age", 42]]));

            expect(job.properties.get("age")).toBe(42);
            expect(persistence.create).toHaveBeenCalledOnce();
            expect(createdJob()).toBe(job);
        });

    });

    describe("updateJob", () => {

        const actor = new Human("chris", "admin");

        it("saves the updated properties and re-enqueues the job", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [new PropertyDefinition("colour")]);

            await machine.updateJob("job-1", new Map([["colour", "blue"]]), actor);

            expect(persistence.save).toHaveBeenCalledOnce();
            expect(savedProperties()?.get("colour")).toBe("blue");
            expect(persistence.save.mock.calls[0][0]).toBe(actor);
            expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith("job-1", WORKFLOW_ID);
        });

        it("does not demand required properties on update", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.updateJob("job-1", new Map([["age", 43]]), actor)).resolves.toBeUndefined();
        });

        it("rejects an invalid value without saving", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.updateJob("job-1", new Map([["age", "old"]]), actor)).rejects.toThrowError("Invalid properties");
            expect(persistence.save).not.toHaveBeenCalled();
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

    describe("executeAction", () => {

        const approvalAction = () => {
            const action = new Action("Approve", new Human("chris", "admin"));
            action.run = async () => new Map([["approved", true]]);
            return action;
        };

        it("saves the action's properties and re-enqueues the job", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [new PropertyDefinition("approved")]);

            await machine.executeAction("job-1", approvalAction());

            expect(persistence.save).toHaveBeenCalledOnce();
            expect(savedProperties()?.get("approved")).toBe(true);
            expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith("job-1", WORKFLOW_ID);
        });

        it("refuses when the action's predicate is unmet", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [new PropertyDefinition("approved")]);
            const action = approvalAction();
            action.predicate = () => false;

            await expect(machine.executeAction("job-1", action)).rejects.toThrowError("Action predicate unmet");
            expect(persistence.save).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
        });

        it("refuses properties that fail the schema", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")]);

            await expect(machine.executeAction("job-1", approvalAction()))
                .rejects.toThrowError("The action generated invalid properties");
            expect(persistence.save).not.toHaveBeenCalled();
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

            expect(savedProperties()?.get("first")).toBe(true);
            expect(savedProperties()?.get("second")).toBe(true);
            expect(savedProperties()?.has("skipped")).toBe(false);
        });

        it("changes nothing when an action keeps the default run stub", async () => {
            const job = jobInState("start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [new Action("Approve", new Human("chris", "admin"))])]);

            await progressJob("job-1");

            expect(persistence.save).not.toHaveBeenCalled();
        });

        it("discards action properties that fail the schema", async () => {
            const job = jobInState("start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [stampingAction("unknown", true)])]);

            await progressJob("job-1");

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

        it("does not progress a killed job", async () => {
            const job = new Job("job-1", new Map(), "start", WORKFLOW_ID, "system", new Date(), new Date(), true);
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [stampingAction("touched", true)])], [new PropertyDefinition("touched")]);

            await progressJob("job-1");

            expect(persistence.save).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
            expect(queue.schedule).not.toHaveBeenCalled();
        });

        it("saves a property-only change with no new state and schedules a back-off re-enqueue", async () => {
            const job = jobInState("start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [stampingAction("touched", true)])], [new PropertyDefinition("touched")]);

            await progressJob("job-1");

            expect(persistence.save).toHaveBeenCalledOnce();
            expect(savedProperties()?.get("touched")).toBe(true);
            expect(savedState()).toBeUndefined();
            expect(queue.enqueue).not.toHaveBeenCalled();
            expect(queue.schedule).toHaveBeenCalledExactlyOnceWith("job-1", WORKFLOW_ID, expect.any(Date));
        });

        it("does not save or re-enqueue when an action rewrites an unchanged value", async () => {
            const job = new Job("job-1", new Map([["touched", true]]), "start");
            persistence.retrieve.mockResolvedValue(job);
            machineWith([new State("start", [stampingAction("touched", true)])], [new PropertyDefinition("touched")]);

            await progressJob("job-1");

            expect(persistence.save).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
            expect(queue.schedule).not.toHaveBeenCalled();
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

                expect(savedState()).toBe("approved");
            });

            it("stops without re-enqueuing when a transition reaches a terminal state", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([
                    new State("start", [], [new Transition("done", () => true)]),
                    new Terminal("done", Terminal.Outcome.SUCCESS),
                ]);

                await progressJob("job-1");

                expect(savedState()).toBe("done");
                expect(queue.enqueue).not.toHaveBeenCalled();
                expect(queue.schedule).not.toHaveBeenCalled();
            });

            it("leaves the state unchanged when no transition matches", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([
                    new State("start", [], [new Transition("done", () => false)]),
                    new State("done"),
                ]);

                await progressJob("job-1");

                expect(persistence.save).not.toHaveBeenCalled();
            });

            it("applies at most one transition per progression", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([
                    new State("start", [], [new Transition("middle", () => true)]),
                    new State("middle", [], [new Transition("done", () => true)]),
                ]);

                await progressJob("job-1");

                expect(savedState()).toBe("middle");
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

                expect(savedState()).toBe("done");
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

                expect(savedState()).toBe("done");
            });

            it("saves the new state and re-enqueues the job after transitioning", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                machineWith([new State("start", [], [new Transition("done", () => true)]), new State("done")]);

                await progressJob("job-1");

                expect(persistence.save).toHaveBeenCalledOnce();
                expect(savedState()).toBe("done");
                expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith("job-1", WORKFLOW_ID);
            });

        });

    });

});
