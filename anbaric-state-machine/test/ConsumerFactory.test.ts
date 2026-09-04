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

    it("returns a fresh consumer per call", () => {
        const queue = new InMemoryQueue();

        expect(ConsumerFactory.instance(queue)).not.toBe(ConsumerFactory.instance(queue));
    });

});
