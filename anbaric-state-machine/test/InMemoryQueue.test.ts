import {beforeEach, describe, expect, it} from "vitest";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";

const secondsFromNow = (seconds : number) => new Date(Date.now() + seconds * 1000);

const message = (jobId : string, workflowId : string = "workflow-1") => ({ jobId, workflowId });

describe("InMemoryQueue", () => {

    let queue : InMemoryQueue;

    beforeEach(() => {
        queue = new InMemoryQueue();
    });

    it("dequeues enqueued messages in FIFO order", async () => {
        await queue.enqueue("a", "workflow-1");
        await queue.enqueue("b", "workflow-2");
        await queue.enqueue("c", "workflow-1");

        expect(await queue.dequeueSome()).toEqual([
            message("a"), message("b", "workflow-2"), message("c"),
        ]);
    });

    it("drains the queue on dequeue", async () => {
        await queue.enqueue("a", "workflow-1");

        await queue.dequeueSome();

        expect(await queue.dequeueSome()).toEqual([]);
    });

    it("releases scheduled messages once their due date has passed", async () => {
        await queue.schedule("a", "workflow-1", secondsFromNow(-1));

        expect(await queue.dequeueSome()).toEqual([message("a")]);
    });

    it("holds back messages scheduled for the future", async () => {
        await queue.schedule("a", "workflow-1", secondsFromNow(60));

        expect(await queue.dequeueSome()).toEqual([]);
    });

    it("keeps future messages parked across drains", async () => {
        await queue.schedule("a", "workflow-1", secondsFromNow(60));

        await queue.dequeueSome();
        await queue.enqueue("b", "workflow-1");

        expect(await queue.dequeueSome()).toEqual([message("b")]);
    });

    it("returns ready messages before released scheduled messages", async () => {
        await queue.schedule("late", "workflow-1", secondsFromNow(-1));
        await queue.enqueue("ready", "workflow-1");

        expect(await queue.dequeueSome()).toEqual([message("ready"), message("late")]);
    });

    it("orders released messages by due date, earliest first", async () => {
        await queue.schedule("later", "workflow-1", secondsFromNow(-10));
        await queue.schedule("earliest", "workflow-1", secondsFromNow(-30));
        await queue.schedule("middle", "workflow-1", secondsFromNow(-20));

        expect(await queue.dequeueSome()).toEqual([
            message("earliest"), message("middle"), message("later"),
        ]);
    });

});
