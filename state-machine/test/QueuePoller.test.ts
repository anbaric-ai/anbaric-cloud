import {describe, expect, it, vi} from "vitest";
import {Queue} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";
import {QueuePoller} from "../src/scheduling/QueuePoller";

const pollerFor = (queue : Queue, stateMachine : StateMachine) =>
    new QueuePoller(queue, stateMachine) as unknown as { poll() : void };

describe("QueuePoller", () => {

    it("progresses every job drained from the queue", () => {
        const queue : Queue = {
            enqueue: vi.fn(),
            schedule: vi.fn(),
            dequeueSome: vi.fn(() => ["job-1", "job-2"]),
        };
        const stateMachine = { progressJob: vi.fn() } as unknown as StateMachine;

        pollerFor(queue, stateMachine).poll();

        expect(queue.dequeueSome).toHaveBeenCalledOnce();
        expect(stateMachine.progressJob).toHaveBeenCalledTimes(2);
        expect(stateMachine.progressJob).toHaveBeenNthCalledWith(1, "job-1");
        expect(stateMachine.progressJob).toHaveBeenNthCalledWith(2, "job-2");
    });

    it("progresses nothing when the queue is empty", () => {
        const queue : Queue = {
            enqueue: vi.fn(),
            schedule: vi.fn(),
            dequeueSome: vi.fn(() => []),
        };
        const stateMachine = { progressJob: vi.fn() } as unknown as StateMachine;

        pollerFor(queue, stateMachine).poll();

        expect(stateMachine.progressJob).not.toHaveBeenCalled();
    });

});
