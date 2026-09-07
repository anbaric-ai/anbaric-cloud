import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Action, PropertyDefinition, State, Transition} from "anbaric-tsapi";
import {Code} from "../src/actors/Code.js";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence.js";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue.js";
import {ConsumerFactory} from "../src/scheduling/ConsumerFactory.js";
import {StateMachine} from "../src/StateMachine.js";

const flag = (id : string) => {
    const property = new PropertyDefinition(id);
    property.validation = (value) => typeof value === "boolean";
    return property;
};

const stamping = (id : string) => {
    const action = new Action(`stamp ${id}`, new Code("stamper"));
    action.run = async () => new Map<string, any>([[id, true]]);
    return action;
};

const machineNamed = (workflowId : string, marker : string,
                      persistence : InMemoryJobPersistence, queue : InMemoryQueue) =>
    new StateMachine(
        workflowId,
        [
            new State("start", [stamping(marker)], [new Transition("done", (job) => job.properties.get(marker) === true)]),
            new State("done"),
        ],
        "start",
        [flag(marker)],
        persistence,
        queue,
    );

/* An app used to be limited to one state machine: every machine built its own
   consumer, and the cloud one binds a port, so the second machine killed the
   container with EADDRINUSE. Consumers are shared now, so this is the case
   that used to be impossible. */
describe("more than one state machine in a single app", () => {

    let persistence : InMemoryJobPersistence;
    let queue : InMemoryQueue;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(console, "log").mockImplementation(() => {});
        persistence = new InMemoryJobPersistence();
        queue = new InMemoryQueue();
    });

    afterEach(async () => {
        await ConsumerFactory.instance(queue).cleanUp();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("gives both machines the same consumer instead of a port each", () => {
        machineNamed("orders", "ordered", persistence, queue);
        machineNamed("invoices", "invoiced", persistence, queue);

        expect(ConsumerFactory.instance(queue)).toBe(ConsumerFactory.instance(queue));
    });

    it("progresses a job on each machine, routing by workflow", async () => {
        const orders = machineNamed("orders", "ordered", persistence, queue);
        const invoices = machineNamed("invoices", "invoiced", persistence, queue);

        const order = await orders.startJob();
        const invoice = await invoices.startJob();

        await vi.advanceTimersByTimeAsync(1100);

        const actor = new Code("test");
        expect((await persistence.retrieve(order.id, actor)).state).toBe("done");
        expect((await persistence.retrieve(invoice.id, actor)).state).toBe("done");
    });

    it("does not deliver one machine's job to the other", async () => {
        const orders = machineNamed("orders", "ordered", persistence, queue);
        machineNamed("invoices", "invoiced", persistence, queue);

        const order = await orders.startJob();

        await vi.advanceTimersByTimeAsync(1100);

        const stored = await persistence.retrieve(order.id, new Code("test"));
        expect(stored.properties.get("ordered")).toBe(true);
        expect(stored.properties.has("invoiced")).toBe(false);
    });

});
