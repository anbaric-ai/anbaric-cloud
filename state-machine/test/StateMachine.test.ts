import {beforeEach, describe, expect, it, vi} from "vitest";
import {Action, Job, JobPersistence, PropertyDefinition, Queue, State} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const mockPersistence = () => ({
    save: vi.fn(),
    retrieve: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(() => []),
    updateProperties: vi.fn(),
}) satisfies JobPersistence;

const mockQueue = () => ({
    enqueue: vi.fn(),
    schedule: vi.fn(),
    dequeueSome: vi.fn(() => []),
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

        it("returns a job with a generated uuid in the start state", () => {
            const machine = machineWith([new State("start")]);

            const job = machine.startJob();

            expect(job.id).toMatch(UUID_PATTERN);
            expect(job.stateId).toBe("start");
        });

        it("persists the new job", () => {
            const machine = machineWith([new State("start")]);

            const job = machine.startJob();

            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
        });

        it("enqueues the new job id", () => {
            const machine = machineWith([new State("start")]);

            const job = machine.startJob();

            expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith(job.id);
        });

        it("keeps the given properties", () => {
            const machine = machineWith([new State("start")], [new PropertyDefinition("colour")]);

            const job = machine.startJob(new Map([["colour", "red"]]));

            expect(job.properties.get("colour")).toBe("red");
        });

        it("currently crashes on a property that is not in the schema", () => {
            const machine = machineWith([new State("start")]);

            expect(() => machine.startJob(new Map([["unknown", 1]]))).toThrowError(TypeError);
        });

        it("rejects a missing required property without persisting or enqueueing", () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            expect(() => machine.startJob()).toThrowError('Missing required property "age"');
            expect(persistence.save).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
        });

        it("rejects a property value that fails validation", () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            expect(() => machine.startJob(new Map([["age", "old"]]))).toThrowError('Invalid value for property "age"');
            expect(persistence.save).not.toHaveBeenCalled();
        });

        it("accepts a valid required property", () => {
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            const job = machine.startJob(new Map([["age", 42]]));

            expect(job.properties.get("age")).toBe(42);
            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
        });

    });

    describe("updateJob", () => {

        it("updates the persisted properties and re-enqueues the job", () => {
            persistence.retrieve.mockReturnValue(new Job("job-1"));
            const machine = machineWith([new State("start")], [new PropertyDefinition("colour")]);
            const update = new Map([["colour", "blue"]]);

            machine.updateJob("job-1", update);

            expect(persistence.updateProperties).toHaveBeenCalledExactlyOnceWith("job-1", update);
            expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith("job-1");
        });

        it("does not demand required properties on update", () => {
            persistence.retrieve.mockReturnValue(new Job("job-1"));
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            expect(() => machine.updateJob("job-1", new Map([["age", 43]]))).not.toThrowError();
        });

        it("rejects an invalid value without updating", () => {
            persistence.retrieve.mockReturnValue(new Job("job-1"));
            const machine = machineWith([new State("start")], [requiredNumber("age")]);

            expect(() => machine.updateJob("job-1", new Map([["age", "old"]]))).toThrowError('Invalid value for property "age"');
            expect(persistence.updateProperties).not.toHaveBeenCalled();
            expect(queue.enqueue).not.toHaveBeenCalled();
        });

        it("propagates a retrieval failure for an unknown job", () => {
            persistence.retrieve.mockImplementation(() => {
                throw new Error('No job found with id "missing"');
            });
            const machine = machineWith([new State("start")]);

            expect(() => machine.updateJob("missing", new Map())).toThrowError('No job found with id "missing"');
        });

    });

    describe("progressJob", () => {

        const jobInState = (stateId : string) => {
            const job = new Job("job-1");
            job.setState(stateId);
            return job;
        };

        it("runs only the actions whose predicate matches, in order", () => {
            const ran : Array<string> = [];
            const state = new State("start", [
                appendingAction(ran, "first"),
                appendingAction(ran, "skipped", false),
                appendingAction(ran, "second"),
            ]);
            persistence.retrieve.mockReturnValue(jobInState("start"));
            const machine = machineWith([state]);

            machine.progressJob("job-1");

            expect(ran).toEqual(["first", "second"]);
        });

        it("saves the job returned by the last action", () => {
            const replacement = jobInState("start");
            const replacingAction = new Action();
            replacingAction.run = () => replacement;
            persistence.retrieve.mockReturnValue(jobInState("start"));
            const machine = machineWith([new State("start", [replacingAction])]);

            machine.progressJob("job-1");

            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(replacement);
        });

        it("saves the job unchanged when its state has no actions", () => {
            const job = jobInState("start");
            persistence.retrieve.mockReturnValue(job);
            const machine = machineWith([new State("start")]);

            machine.progressJob("job-1");

            expect(persistence.save).toHaveBeenCalledExactlyOnceWith(job);
        });

    });

});
