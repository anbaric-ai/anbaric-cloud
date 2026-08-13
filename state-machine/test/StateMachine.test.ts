import {beforeEach, describe, expect, it, vi} from "vitest";
import {Action, Job, JobPersistence, PropertyDefinition, Queue, State, Transition} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";

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
    enqueue: vi.fn(async (_jobId : string) => {}),
    schedule: vi.fn(async (_jobId : string, _due : Date) => {}),
    dequeueSome: vi.fn(async () => [] as Array<string>),
}) satisfies Queue;

const requiredNumber = (id : string) => {
    const definition = new PropertyDefinition(id);
    definition.required = true;
    definition.validation = (value) => typeof value === "number";
    return definition;
};

const appendingAction = (log : Array<string>, name : string, accepts : boolean = true) => {
    const action = new Action();
    action.predicate = () => accepts;
    action.run = (job) => {
        log.push(name);
        return job;
    };
    return action;
};

describe("StateMachine", () => {

    let persistence : ReturnType<typeof mockPersistence>;
    let queue : ReturnType<typeof mockQueue>;

    beforeEach(() => {
        persistence = mockPersistence();
        queue = mockQueue();
    });

    const machineWith = (states : Array<State>, schema : Array<PropertyDefinition> = []) =>
        new StateMachine(states, "start", schema, undefined, persistence, queue);

    describe("startJob", () => {

        it("returns a job with a generated uuid in the start state", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob();

            expect(job.id).toMatch(UUID_PATTERN);
            expect(job.stateId).toBe("start");
        });

        it("persists the new job", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob();

            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
        });

        it("enqueues the new job id", async () => {
            const machine = machineWith([new State("start")]);

            const job = await machine.startJob();

            expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith(job.id);
        });

        it("keeps the given properties", async () => {
            const machine = machineWith([new State("start")], [new PropertyDefinition("colour")]);

            const job = await machine.startJob(new Map([["colour", "red"]]));

            expect(job.properties.get("colour")).toBe("red");
        });

        it("currently crashes on a property that is not in the schema", async () => {
            const machine = machineWith([new State("start")]);

            await expect(machine.startJob(new Map([["unknown", 1]]))).rejects.toThrowError(TypeError);
        });

        it("rejects a missing required property without persisting or enqueueing", async () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.startJob()).rejects.toThrowError('Missing required property "age"');
            expect(persistence.save).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
        });

        it("rejects a property value that fails validation", async () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.startJob(new Map([["age", "old"]]))).rejects.toThrowError('Invalid value for property "age"');
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

        it("updates the persisted properties and re-enqueues the job", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [new PropertyDefinition("colour")]);
            const update = new Map([["colour", "blue"]]);

            await machine.updateJob("job-1", update);

            expect(persistence.updateProperties).toHaveBeenCalledExactlyOnceWith("job-1", update);
            expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith("job-1");
        });

        it("does not demand required properties on update", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.updateJob("job-1", new Map([["age", 43]]))).resolves.toBeUndefined();
        });

        it("rejects an invalid value without updating", async () => {
            persistence.retrieve.mockResolvedValue(new Job("job-1", new Map(), "start"));
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            await expect(machine.updateJob("job-1", new Map([["age", "old"]]))).rejects.toThrowError('Invalid value for property "age"');
            expect(persistence.updateProperties).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
        });

        it("propagates a retrieval failure for an unknown job", async () => {
            persistence.retrieve.mockImplementation(() => {
                throw new Error('No job found with id "missing"');
            });
            const machine = machineWith([new State("start")]);

            await expect(machine.updateJob("missing", new Map())).rejects.toThrowError('No job found with id "missing"');
        });

    });

    describe("progressJob", () => {

        const jobInState = (stateId : string) => new Job("job-1", new Map(), stateId);

        it("runs only the actions whose predicate matches, in order", async () => {
            const ran : Array<string> = [];
            const state = new State("start", [
                appendingAction(ran, "first"),
                appendingAction(ran, "skipped", false),
                appendingAction(ran, "second"),
            ]);
            persistence.retrieve.mockResolvedValue(jobInState("start"));
            const machine = machineWith([state]);

            await machine.progressJob("job-1");

            expect(ran).toEqual(["first", "second"]);
        });

        it("saves the job returned by the last action", async () => {
            const replacement = jobInState("start");
            const replacingAction = new Action();
            replacingAction.run = () => replacement;
            persistence.retrieve.mockResolvedValue(jobInState("start"));
            const machine = machineWith([new State("start", [replacingAction])]);

            await machine.progressJob("job-1");

            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(replacement);
        });

        it("saves the job unchanged when its state has no actions", async () => {
            const job = jobInState("start");
            persistence.retrieve.mockResolvedValue(job);
            const machine = machineWith([new State("start")]);

            await machine.progressJob("job-1");

            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
        });

        describe("transitions", () => {

            it("applies the first transition whose predicate matches", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                const machine = machineWith([new State("start", [], [
                    new Transition("rejected", () => false),
                    new Transition("approved", () => true),
                    new Transition("archived", () => true),
                ])]);

                await machine.progressJob("job-1");

                expect(job.stateId).toBe("approved");
            });

            it("leaves the state unchanged when no transition matches", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                const machine = machineWith([new State("start", [], [
                    new Transition("done", () => false),
                ])]);

                await machine.progressJob("job-1");

                expect(job.stateId).toBe("start");
            });

            it("applies at most one transition per progression", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                const machine = machineWith([
                    new State("start", [], [new Transition("middle", () => true)]),
                    new State("middle", [], [new Transition("done", () => true)]),
                ]);

                await machine.progressJob("job-1");

                expect(job.stateId).toBe("middle");
            });

            it("evaluates transition predicates after the actions have run", async () => {
                const approve = new Action();
                approve.run = (job) => {
                    job.properties.set("approved", true);
                    return job;
                };
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                const machine = machineWith([new State("start", [approve], [
                    new Transition("done", (candidate) => candidate.properties.get("approved") === true),
                ])]);

                await machine.progressJob("job-1");

                expect(job.stateId).toBe("done");
            });

            it("saves the job after transitioning", async () => {
                const job = jobInState("start");
                persistence.retrieve.mockResolvedValue(job);
                const machine = machineWith([new State("start", [], [
                    new Transition("done", () => true),
                ])]);

                await machine.progressJob("job-1");

                expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
                expect(persistence.save.mock.calls[0][0].stateId).toBe("done");
            });

        });

    });

});
