import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {CloudQueue} from "anbaric-cloud";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";
import {QueueFactory} from "../src/scheduling/QueueFactory";

describe("QueueFactory", () => {

    let originalQueueType : string | undefined;

    beforeEach(() => {
        originalQueueType = process.env.ANBARIC_QUEUE_TYPE;
    });

    afterEach(() => {
        if (originalQueueType === undefined) {
            delete process.env.ANBARIC_QUEUE_TYPE;
        } else {
            process.env.ANBARIC_QUEUE_TYPE = originalQueueType;
        }
    });

    it("defaults to the in-memory queue when the env var is unset", () => {
        delete process.env.ANBARIC_QUEUE_TYPE;

        expect(QueueFactory.instance()).toBeInstanceOf(InMemoryQueue);
    });

    it("returns the in-memory queue for the memory type", () => {
        process.env.ANBARIC_QUEUE_TYPE = "memory";

        expect(QueueFactory.instance()).toBeInstanceOf(InMemoryQueue);
    });

    it("returns the cloud client for the cloud type", () => {
        process.env.ANBARIC_QUEUE_TYPE = "cloud";

        expect(QueueFactory.instance()).toBeInstanceOf(CloudQueue);
    });

    it("returns a fresh queue per call", () => {
        expect(QueueFactory.instance()).not.toBe(QueueFactory.instance());
    });

});
