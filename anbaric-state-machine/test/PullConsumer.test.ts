import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";
import {PullConsumer} from "../src/scheduling/PullConsumer";

const POLL_INTERVAL_MS = 10;

describe("PullConsumer", () => {

    let queue : InMemoryQueue;
    let consumer : PullConsumer;

    beforeEach(() => {
        queue = new InMemoryQueue();
        consumer = new PullConsumer(queue, POLL_INTERVAL_MS);
    });

    afterEach(async () => {
        await consumer.cleanUp();
    });

    it("forwards messages to the subscriber for their workflow", async () => {
        const processJob = vi.fn(async () => {});
        consumer.subscribe(undefined, "workflow-1", processJob);

        await queue.enqueue("job-1", undefined, "workflow-1");

        await vi.waitFor(() => expect(processJob).toHaveBeenCalledExactlyOnceWith("job-1"));
    });

    it("routes each message only to its own workflow's subscriber", async () => {
        const first = vi.fn(async () => {});
        const second = vi.fn(async () => {});
        consumer.subscribe(undefined, "workflow-1", first);
        consumer.subscribe(undefined, "workflow-2", second);

        await queue.enqueue("job-1", undefined, "workflow-1");
        await queue.enqueue("job-2", undefined, "workflow-2");

        await vi.waitFor(() => {
            expect(first).toHaveBeenCalledExactlyOnceWith("job-1");
            expect(second).toHaveBeenCalledExactlyOnceWith("job-2");
        });
    });

    it("keeps messages for unsubscribed workflows until a subscriber appears", async () => {
        const subscribed = vi.fn(async () => {});
        consumer.subscribe(undefined, "workflow-1", subscribed);

        await queue.enqueue("job-x", undefined, "workflow-2");
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS * 5));
        expect(subscribed).not.toHaveBeenCalled();

        const lateSubscriber = vi.fn(async () => {});
        consumer.subscribe(undefined, "workflow-2", lateSubscriber);

        await vi.waitFor(() => expect(lateSubscriber).toHaveBeenCalledExactlyOnceWith("job-x"));
    });

    it("retries a message whose processing fails", async () => {
        const processJob = vi.fn(async () => {})
            .mockRejectedValueOnce(new Error("transient failure"));
        consumer.subscribe(undefined, "workflow-1", processJob);

        await queue.enqueue("job-1", undefined, "workflow-1");

        await vi.waitFor(() => expect(processJob).toHaveBeenCalledTimes(2));
        expect(processJob).toHaveBeenLastCalledWith("job-1");
    });

    it("processes nothing after cleanUp", async () => {
        const processJob = vi.fn(async () => {});
        consumer.subscribe(undefined, "workflow-1", processJob);

        await consumer.cleanUp();
        await queue.enqueue("job-1", undefined, "workflow-1");
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS * 5));

        expect(processJob).not.toHaveBeenCalled();
    });

});
