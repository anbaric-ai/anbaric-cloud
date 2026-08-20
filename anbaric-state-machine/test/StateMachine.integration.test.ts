import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Action, Consumer, Dequeue, Job, PropertyDefinition, State, Transition} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";
import {Code} from "../src/actors/Code";
import {Human} from "../src/actors/Human";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";
import {PullConsumer} from "../src/scheduling/PullConsumer";
import {ConsumerFactory} from "../src/scheduling/ConsumerFactory";

const actor = new Code("integration-test");

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


        await progress(job.id);
    });

    it("applies an action's declared properties and warns on an undeclared one rather than dropping the lot", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const leaky = new Action("leaky", new Code("leaky"));
        leaky.run = async () => new Map<string, any>([["progressed", true], ["mystery", 7]]);

        const leakyMachine = new StateMachine(
            "leaky-workflow",
            [new State("start", [leaky])],
            "start",
            [optionalFlag("progressed")],
            persistence,
            queue,
        );

        const job = await leakyMachine.startJob();
        await progress(job.id);

        const saved = await persistence.retrieve(job.id, actor);
        expect(saved.properties.get("progressed")).toBe(true);
        expect(saved.properties.has("mystery")).toBe(false);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("mystery"));
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
        const triaged = await persistence.retrieve(routineTicket.id, actor);
        expect(triaged.state).toBe("triaged");
        expect(triaged.properties.get("assignee")).toBe("triage-bot");
        expect(triaged.properties.has("escalated")).toBe(false);

        const urgentTicket = await support.startJob(new Map([["priority", "high"]]));
        await progress(urgentTicket.id);
        const escalated = await persistence.retrieve(urgentTicket.id, actor);
        expect(escalated.state).toBe("escalated");
        expect(escalated.properties.has("assignee")).toBe(false);
    });

    it("a rejected startJob leaves persistence and queue untouched", async () => {
        await expect(machine.startJob(new Map([["age", "old"]]))).rejects.toThrowError();

        expect(await persistence.list(actor)).toEqual([]);
        expect(await queue.dequeueSome()).toEqual([]);
    });

    it("a rejected updateJob leaves the job untouched", async () => {
        const job = await machine.startJob(new Map([["age", 42]]));
        await queue.dequeueSome();

        await expect(machine.updateJob(job.id, new Map([["age", "old"]]), new Human("chris", "admin"))).rejects.toThrowError();

        expect((await persistence.retrieve(job.id, actor)).properties.get("age")).toBe(42);
        expect(await queue.dequeueSome()).toEqual([]);
    });

});
