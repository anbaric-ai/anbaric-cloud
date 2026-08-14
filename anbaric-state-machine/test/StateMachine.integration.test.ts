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

const optionalText = (id : string) => {
    const definition = new PropertyDefinition(id);
    definition.validation = (value) => typeof value === "string";
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

    it("carries an expense claim through review, human approval and payout", async () => {
        const checkReceipts = stampingAction("receiptChecked", true);
        const payOut = stampingAction("paid", true);
        const approve = new Action("Approve claim", new Human("marisa", "manager"));
        approve.predicate = (job) => job.properties.get("receiptChecked") === true;
        approve.run = async () => new Map([["approved", true]]);

        const expenses = new StateMachine(
            "expense-approval",
            [
                new State("submitted", [checkReceipts], [
                    new Transition("rejected", (job) => job.properties.get("approved") === false),
                    new Transition("approved", (job) => job.properties.get("approved") === true),
                ]),
                new State("approved", [payOut], [new Transition("paid", (job) => job.properties.get("paid") === true)]),
                new State("rejected"),
                new State("paid"),
            ],
            "submitted",
            [optionalNumber("amount"), optionalFlag("receiptChecked"), optionalFlag("approved"), optionalFlag("paid")],
            persistence,
            queue,
        );

        const claim = await expenses.startJob(new Map([["amount", 120]]), new Human("lyra", "requester"));
        expect(claim.startedBy).toBe("lyra");

        await progress(claim.id);
        expect((await persistence.retrieve(claim.id)).stateId).toBe("submitted");

        await expenses.executeAction(claim.id, approve);
        await progress(claim.id);
        expect((await persistence.retrieve(claim.id)).stateId).toBe("approved");

        await progress(claim.id);
        const settled = await persistence.retrieve(claim.id);
        expect(settled.stateId).toBe("paid");
        expect(settled.properties.get("receiptChecked")).toBe(true);
        expect(settled.transitions).toEqual([
            { from: "submitted", to: "approved", actor: "expense-approval" },
            { from: "approved", to: "paid", actor: "expense-approval" },
        ]);
    });

    it("branches an order to cancellation or shipping depending on its properties", async () => {
        const orderMachine = () => new StateMachine(
            "order-fulfilment",
            [
                new State("placed", [], [
                    new Transition("cancelled", (job) => job.properties.get("cancelled") === true),
                    new Transition("packing", (job) => job.properties.get("paid") === true),
                ]),
                new State("packing", [stampingAction("packed", true)],
                    [new Transition("shipped", (job) => job.properties.get("packed") === true)]),
                new State("cancelled"),
                new State("shipped"),
            ],
            "placed",
            [optionalFlag("paid"), optionalFlag("cancelled"), optionalFlag("packed")],
            persistence,
            queue,
        );

        const orders = orderMachine();
        const shippedOrder = await orders.startJob();
        await orders.updateJob(shippedOrder.id, new Map([["paid", true]]), new Human("lyra", "customer"));
        await progress(shippedOrder.id);
        await progress(shippedOrder.id);
        expect((await persistence.retrieve(shippedOrder.id)).stateId).toBe("shipped");

        const cancelledOrder = await orders.startJob();
        await orders.updateJob(cancelledOrder.id, new Map([["cancelled", true]]), new Human("lyra", "customer"));
        await progress(cancelledOrder.id);
        expect((await persistence.retrieve(cancelledOrder.id)).stateId).toBe("cancelled");
        expect((await persistence.retrieve(cancelledOrder.id)).transitions).toEqual([
            { from: "placed", to: "cancelled", actor: "order-fulfilment" },
        ]);
    });

    it("routes tickets through different paths as action predicates select who acts", async () => {
        const autoTriage = new Action("Auto triage", new Code("triage-bot"));
        autoTriage.predicate = (job) => job.properties.get("priority") === "low";
        autoTriage.run = async () => new Map([["assignee", "triage-bot"]]);

        const escalate = new Action("Escalate", new Code("escalation-rule"));
        escalate.predicate = (job) => job.properties.get("priority") === "high";
        escalate.run = async () => new Map([["escalated", true]]);

        const support = new StateMachine(
            "support-triage",
            [
                new State("open", [autoTriage, escalate], [
                    new Transition("escalated", (job) => job.properties.get("escalated") === true),
                    new Transition("triaged", (job) => job.properties.get("assignee") !== undefined),
                ]),
                new State("escalated"),
                new State("triaged"),
            ],
            "open",
            [optionalText("priority"), optionalText("assignee"), optionalFlag("escalated")],
            persistence,
            queue,
        );

        const routineTicket = await support.startJob(new Map([["priority", "low"]]));
        await progress(routineTicket.id);
        const triaged = await persistence.retrieve(routineTicket.id);
        expect(triaged.stateId).toBe("triaged");
        expect(triaged.properties.get("assignee")).toBe("triage-bot");
        expect(triaged.properties.has("escalated")).toBe(false);

        const urgentTicket = await support.startJob(new Map([["priority", "high"]]));
        await progress(urgentTicket.id);
        const escalated = await persistence.retrieve(urgentTicket.id);
        expect(escalated.stateId).toBe("escalated");
        expect(escalated.properties.has("assignee")).toBe(false);
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
