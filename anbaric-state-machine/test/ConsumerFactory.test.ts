import {describe, expect, it} from "vitest";
import {CloudQueue, PushConsumer} from "anbaric-impl-cloud";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue.js";
import {PullConsumer} from "../src/scheduling/PullConsumer.js";
import {ConsumerFactory} from "../src/scheduling/ConsumerFactory.js";

describe("ConsumerFactory", () => {

    it("creates a pull consumer for a queue that supports dequeueing", () => {
        expect(ConsumerFactory.instance(new InMemoryQueue())).toBeInstanceOf(PullConsumer);
    });

    it("creates a push consumer for a produce-only queue", () => {
        expect(ConsumerFactory.instance(new CloudQueue("http://platform.invalid"))).toBeInstanceOf(PushConsumer);
    });

    it("shares one pull consumer per queue, so a queue is drained once", () => {
        const queue = new InMemoryQueue();

        expect(ConsumerFactory.instance(queue)).toBe(ConsumerFactory.instance(queue));
    });

    it("gives separate queues their own pull consumer, or one would never be drained", () => {
        expect(ConsumerFactory.instance(new InMemoryQueue())).not.toBe(ConsumerFactory.instance(new InMemoryQueue()));
    });

    // A push consumer binds a port, so a second instance in one app would die
    // on EADDRINUSE - which is what limited a deployed app to one machine.
    it("shares a single push consumer across every machine in the app", () => {
        const first = ConsumerFactory.instance(new CloudQueue("http://platform.invalid"));
        const second = ConsumerFactory.instance(new CloudQueue("http://platform.invalid"));

        expect(first).toBe(second);
    });

    it("gives a different platform its own push consumer", () => {
        process.env.ANBARIC_CLOUD_URL = "http://one.invalid";
        const first = ConsumerFactory.instance(new CloudQueue("http://one.invalid"));

        process.env.ANBARIC_CLOUD_URL = "http://two.invalid";
        const second = ConsumerFactory.instance(new CloudQueue("http://two.invalid"));

        delete process.env.ANBARIC_CLOUD_URL;
        expect(first).not.toBe(second);
    });

});
