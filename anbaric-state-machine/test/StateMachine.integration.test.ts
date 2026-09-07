import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Action, Await, Consumer, Dequeue, Job, PropertyDefinition, State, Terminal, Transition, WaitForInput} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine.js";
import {Code} from "../src/actors/Code.js";
import {Human} from "../src/actors/Human.js";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence.js";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue.js";
import {PullConsumer} from "../src/scheduling/PullConsumer.js";
import {ConsumerFactory} from "../src/scheduling/ConsumerFactory.js";

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
        subscribe: (_appId, _workflowId, processJob) => {
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

    describe("notifying who a job is waiting on", () => {

        const notifier = () => ({
            notify: vi.fn(async (_targets : Array<string>, _job : Job, _waiting : WaitForInput) => {}),
        });

        const awaitingMachine = (waiting : Await, notify? : ReturnType<typeof notifier>) =>
            new StateMachine(
                "awaiting-workflow",
                [new State("review", [waiting]), new State("done")],
                "review",
                [optionalFlag("progressed")],
                persistence,
                queue,
                notify,
            );

        const reviewAwait = (targets : Array<string>) => {
            const waiting = new Await("Review", "HUMAN", "A human reviews it", "await-1", targets);
            waiting.resolveUrl = (job) => `/runs/${job.id}`;
            return waiting;
        };

        it("hands the await's targets to the notifier when a job parks", async () => {
            const notify = notifier();
            const machine = awaitingMachine(reviewAwait(["reviewer@example.com"]), notify);

            const job = await machine.startJob();
            await progress(job.id);

            expect(notify.notify).toHaveBeenCalledOnce();
            expect(notify.notify.mock.calls[0][0]).toEqual(["reviewer@example.com"]);
        });

        // The notifier is given the resolved wait, so it can tell someone where
        // to go without knowing anything about the machine.
        it("passes the job and its resolved wait, including the resolve url", async () => {
            const notify = notifier();
            const machine = awaitingMachine(reviewAwait(["a@example.com", "b@example.com"]), notify);

            const job = await machine.startJob();
            await progress(job.id);

            const [targets, notified, waiting] = notify.notify.mock.calls[0];
            expect(targets).toHaveLength(2);
            expect(notified.id).toBe(job.id);
            expect(waiting.resolveUrl).toBe(`/runs/${job.id}`);
        });

        it("does not notify when the await names nobody", async () => {
            const notify = notifier();
            const machine = awaitingMachine(reviewAwait([]), notify);

            await progress((await machine.startJob()).id);

            expect(notify.notify).not.toHaveBeenCalled();
        });

        it("parks the job as normal when there is no notifier at all", async () => {
            const machine = awaitingMachine(reviewAwait(["reviewer@example.com"]), undefined);

            const job = await machine.startJob();
            await progress(job.id);

            expect((await persistence.retrieve(job.id, actor)).status).toBe(Job.Status.AWAITING_INPUT);
        });

        // Notifying is a side channel; a job that is legitimately waiting must
        // not be disturbed because an email bounced.
        it("still parks the job when notifying throws", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            const notify = { notify: vi.fn(async () => { throw new Error("SMTP is down"); }) };
            const machine = awaitingMachine(reviewAwait(["reviewer@example.com"]), notify);

            const job = await machine.startJob();
            await expect(progress(job.id)).resolves.toBeUndefined();

            expect((await persistence.retrieve(job.id, actor)).status).toBe(Job.Status.AWAITING_INPUT);
        });

    });

    describe("an action that throws", () => {

        const throwingMachine = (message : string) => {
            const explode = new Action("explode", new Code("exploder"));
            explode.run = async () => { throw new Error(message); };

            return new StateMachine(
                "throwing-workflow",
                [new State("start", [explode], [new Transition("done", () => true)]), new State("done")],
                "start",
                [optionalFlag("progressed")],
                persistence,
                queue,
            );
        };

        it("marks the job failed rather than leaving it silently stuck", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            const machine = throwingMachine("the vendor API is down");

            const job = await machine.startJob();
            await progress(job.id);

            const saved = await persistence.retrieve(job.id, actor);
            expect(saved.status).toBe(Job.Status.FAILED);
        });

        // The whole point: progressJob resolving is what lets the consumer
        // confirm the queue message instead of the job wedging.
        it("does not propagate the error to the consumer", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            const machine = throwingMachine("the vendor API is down");

            const job = await machine.startJob();

            await expect(progress(job.id)).resolves.toBeUndefined();
        });

        it("records why it failed, naming the action and the reason", async () => {
            const error = vi.spyOn(console, "error").mockImplementation(() => {});
            const machine = throwingMachine("the vendor API is down");

            const job = await machine.startJob();
            await progress(job.id);

            expect(error).toHaveBeenCalledWith(expect.stringContaining("explode"));
            expect(error).toHaveBeenCalledWith(expect.stringContaining("the vendor API is down"));
        });

        it("does not transition a job whose action failed", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            const machine = throwingMachine("boom");

            const job = await machine.startJob();
            await progress(job.id);

            expect((await persistence.retrieve(job.id, actor)).state).toBe("start");
        });

    });

    it("does not re-enqueue when an action rewrites an unchanged value", async () => {
        const restamp = new Action("restamp", new Code("restamp"));
        restamp.run = async () => new Map([["progressed", true]]);

        const idle = new StateMachine(
            "idle-workflow",
            [new State("start", [restamp])],
            "start",
            [optionalFlag("progressed")],
            persistence,
            queue,
        );

        const enqueue = vi.spyOn(queue, "enqueue");
        const schedule = vi.spyOn(queue, "schedule");
        const job = await idle.startJob(new Map([["progressed", true]]));
        enqueue.mockClear();

        await progress(job.id);

        expect(enqueue).not.toHaveBeenCalled();
        expect(schedule).not.toHaveBeenCalled();
    });

    it("backs off with a scheduled re-enqueue when a job changes but stays in the same state", async () => {
        const tick = new Action("tick", new Code("ticker"));
        tick.run = async (job) => new Map([["attempts", (job.properties.get("attempts") ?? 0) + 1]]);

        const poller = new StateMachine(
            "poller",
            [new State("waiting", [tick])],
            "waiting",
            [optionalNumber("attempts")],
            persistence,
            queue,
        );

        const enqueue = vi.spyOn(queue, "enqueue");
        const schedule = vi.spyOn(queue, "schedule");
        const job = await poller.startJob();
        enqueue.mockClear();

        await progress(job.id);

        expect(enqueue).not.toHaveBeenCalled();
        expect(schedule).toHaveBeenCalledTimes(1);
        expect((schedule.mock.calls[0][3] as Date).getTime()).toBeGreaterThan(Date.now());
        expect((await persistence.retrieve(job.id, actor)).properties.get("attempts")).toBe(1);
    });

    it("stops at a terminal state without re-enqueuing", async () => {
        const finisher = new StateMachine(
            "finisher",
            [
                new State("working", [stampingAction("done", true)], [new Transition("finished", (job) => job.properties.get("done") === true)]),
                new Terminal("finished", Terminal.Outcome.SUCCESS),
            ],
            "working",
            [optionalFlag("done")],
            persistence,
            queue,
        );

        const enqueue = vi.spyOn(queue, "enqueue");
        const schedule = vi.spyOn(queue, "schedule");
        const job = await finisher.startJob();
        enqueue.mockClear();

        await progress(job.id);

        expect((await persistence.retrieve(job.id, actor)).state).toBe("finished");
        expect(enqueue).not.toHaveBeenCalled();
        expect(schedule).not.toHaveBeenCalled();
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

    const approvalMachine = () => {
        const approval = new Await("Approve the order", "HUMAN");
        approval.fields = ["approved"];
        approval.resolveUrl = (job) => `/approve?job=${job.id}`;
        approval.metadata = (job) => new Map([["orderState", job.state]]);

        return new StateMachine(
            "approvals",
            [
                new State("review", [approval], [new Transition("approved", (job) => job.properties.get("approved") === true)]),
                new State("approved"),
            ],
            "review",
            [optionalFlag("approved")],
            persistence,
            queue,
        );
    };

    it("parks a job in Awaiting input when it reaches an Await, without enqueuing", async () => {
        const machine = approvalMachine();
        const enqueue = vi.spyOn(queue, "enqueue");
        const schedule = vi.spyOn(queue, "schedule");

        const job = await machine.startJob();
        enqueue.mockClear();
        await progress(job.id);

        const parked = await persistence.retrieve(job.id, actor);
        expect(parked.status).toBe(Job.Status.AWAITING_INPUT);
        expect(parked.state).toBe("review");
        expect(parked.waitingFor).toBeDefined();
        expect(parked.awaitMetadata?.waitingFor).toBe("HUMAN");
        expect(parked.awaitMetadata?.fields).toEqual(["approved"]);
        expect(parked.awaitMetadata?.resolveUrl).toBe(`/approve?job=${job.id}`);
        expect(parked.awaitMetadata?.metadataMap.get("orderState")).toBe("review");
        expect(enqueue).not.toHaveBeenCalled();
        expect(schedule).not.toHaveBeenCalled();
    });

    it("resumes a parked job via a transition when its properties are updated, clearing the await", async () => {
        const machine = approvalMachine();
        const job = await machine.startJob();
        await progress(job.id);

        await machine.updateJob(job.id, new Map([["approved", true]]), new Human("chris", "admin"));
        await progress(job.id);

        const resumed = await persistence.retrieve(job.id, actor);
        expect(resumed.state).toBe("approved");
        expect(resumed.status).toBe(Job.Status.ACTIVE);
        expect(resumed.waitingFor).toBeUndefined();
        expect(resumed.awaitMetadata).toBeUndefined();
    });

    it("does not run actions placed after an Await when resuming", async () => {
        const afterAwait = new Action("post-await", new Code("post-await"));
        const ran = vi.fn(async () => new Map([["progressed", true]]));
        afterAwait.run = ran;

        const machine = new StateMachine(
            "await-then-act",
            [
                new State("review", [new Await("Wait", "HUMAN"), afterAwait],
                    [new Transition("done", (job) => job.properties.get("approved") === true)]),
                new State("done"),
            ],
            "review",
            [optionalFlag("approved"), optionalFlag("progressed")],
            persistence,
            queue,
        );

        const job = await machine.startJob();
        await progress(job.id);
        await machine.updateJob(job.id, new Map([["approved", true]]), new Human("chris", "admin"));
        await progress(job.id);

        expect(ran).not.toHaveBeenCalled();
        expect((await persistence.retrieve(job.id, actor)).state).toBe("done");
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
