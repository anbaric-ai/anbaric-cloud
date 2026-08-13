import {beforeEach, describe, expect, it} from "vitest";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";

const secondsFromNow = (seconds : number) => new Date(Date.now() + seconds * 1000);

describe("InMemoryQueue", () => {

    let queue : InMemoryQueue;

    beforeEach(() => {
        queue = new InMemoryQueue();
    });

    it("dequeues enqueued jobs in FIFO order", async () => {
        await queue.enqueue("a");
        await queue.enqueue("b");
        await queue.enqueue("c");

        expect(await queue.dequeueSome()).toEqual(["a", "b", "c"]);
    });

    it("drains the queue on dequeue", async () => {
        await queue.enqueue("a");

        await queue.dequeueSome();

        expect(await queue.dequeueSome()).toEqual([]);
    });

    it("releases scheduled jobs once their due date has passed", async () => {
        await queue.schedule("a", secondsFromNow(-1));

        expect(await queue.dequeueSome()).toEqual(["a"]);
    });

    it("holds back jobs scheduled for the future", async () => {
        await queue.schedule("a", secondsFromNow(60));

        expect(await queue.dequeueSome()).toEqual([]);
    });

    it("keeps future jobs parked across drains", async () => {
        await queue.schedule("a", secondsFromNow(60));

        await queue.dequeueSome();
        await queue.enqueue("b");

        expect(await queue.dequeueSome()).toEqual(["b"]);
    });

    it("returns ready jobs before released scheduled jobs", async () => {
        await queue.schedule("late", secondsFromNow(-1));
        await queue.enqueue("ready");

        expect(await queue.dequeueSome()).toEqual(["ready", "late"]);
    });

    it("orders released jobs by due date, earliest first", async () => {
        await queue.schedule("later", secondsFromNow(-10));
        await queue.schedule("earliest", secondsFromNow(-30));
        await queue.schedule("middle", secondsFromNow(-20));

        expect(await queue.dequeueSome()).toEqual(["earliest", "middle", "later"]);
    });

});
