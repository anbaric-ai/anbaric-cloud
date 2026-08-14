import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {CloudConsumer} from "anbaric-cloud";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";
import {LocalConsumer} from "../src/scheduling/LocalConsumer";
import {ConsumerFactory} from "../src/scheduling/ConsumerFactory";

describe("ConsumerFactory", () => {

    const queue = new InMemoryQueue();
    let originalConsumerType : string | undefined;

    beforeEach(() => {
        originalConsumerType = process.env.ANBARIC_CONSUMER_TYPE;
    });

    afterEach(() => {
        if (originalConsumerType === undefined) {
            delete process.env.ANBARIC_CONSUMER_TYPE;
        } else {
            process.env.ANBARIC_CONSUMER_TYPE = originalConsumerType;
        }
    });

    it("defaults to the local consumer when the env var is unset", () => {
        delete process.env.ANBARIC_CONSUMER_TYPE;

        expect(ConsumerFactory.instance(queue)).toBeInstanceOf(LocalConsumer);
    });

    it("returns the local consumer for the local type", () => {
        process.env.ANBARIC_CONSUMER_TYPE = "local";

        expect(ConsumerFactory.instance(queue)).toBeInstanceOf(LocalConsumer);
    });

    it("returns the cloud consumer for the cloud type", () => {
        process.env.ANBARIC_CONSUMER_TYPE = "cloud";

        expect(ConsumerFactory.instance(queue)).toBeInstanceOf(CloudConsumer);
    });

    it("returns a fresh consumer per call", () => {
        expect(ConsumerFactory.instance(queue)).not.toBe(ConsumerFactory.instance(queue));
    });

});
