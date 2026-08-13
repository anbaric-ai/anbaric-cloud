import {beforeEach, describe, expect, it} from "vitest";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";

const secondsFromNow = (seconds : number) => new Date(Date.now() + seconds * 1000);

describe("InMemoryQueue", () => {

    let queue : InMemoryQueue;

    beforeEach(() => {
        queue = new InMemoryQueue();
    });

    it("dequeues enqueued jobs in FIFO order", () => {
        queue.enqueue("a");
        queue.enqueue("b");
        queue.enqueue("c");

        expect(queue.dequeueSome()).toEqual(["a", "b", "c"]);
    });

    it("drains the queue on dequeue", () => {
        queue.enqueue("a");

        queue.dequeueSome();

        expect(queue.dequeueSome()).toEqual([]);
    });

    it("releases scheduled jobs once their due date has passed", () => {
        queue.schedule("a", secondsFromNow(-1));

        expect(queue.dequeueSome()).toEqual(["a"]);
    });

    it("holds back jobs scheduled for the future", () => {
        queue.schedule("a", secondsFromNow(60));

        expect(queue.dequeueSome()).toEqual([]);
    });

    it("keeps future jobs parked across drains", () => {
        queue.schedule("a", secondsFromNow(60));

        queue.dequeueSome();
        queue.enqueue("b");

        expect(queue.dequeueSome()).toEqual(["b"]);
    });

    it("returns ready jobs before released scheduled jobs", () => {
        queue.schedule("late", secondsFromNow(-1));
        queue.enqueue("ready");

        expect(queue.dequeueSome()).toEqual(["ready", "late"]);
    });

    it("orders released jobs by due date, earliest first", () => {
        queue.schedule("later", secondsFromNow(-10));
        queue.schedule("earliest", secondsFromNow(-30));
        queue.schedule("middle", secondsFromNow(-20));

        expect(queue.dequeueSome()).toEqual(["earliest", "middle", "later"]);
    });

});
