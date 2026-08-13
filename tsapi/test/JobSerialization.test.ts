import {describe, expect, it} from "vitest";
import {Job} from "../src/api/jobs/Job";
import {deserializeJob, serializeJob} from "../src/api/jobs/JobSerialization";

describe("job serialization", () => {

    it("serializes id, state, and properties", () => {
        const job = new Job("job-1", new Map<string, any>([["colour", "red"], ["age", 42]]), "review");

        expect(serializeJob(job)).toEqual({
            id: "job-1",
            state: "review",
            properties: { colour: "red", age: 42 },
        });
    });

    it("round-trips a job", () => {
        const job = new Job("job-1", new Map([["colour", "red"]]), "review");

        const roundTripped = deserializeJob(serializeJob(job));

        expect(roundTripped.id).toBe("job-1");
        expect(roundTripped.stateId).toBe("review");
        expect(roundTripped.properties).toEqual(new Map([["colour", "red"]]));
    });

    it("round-trips a job with no properties", () => {
        const roundTripped = deserializeJob(serializeJob(new Job("job-1", new Map(), "start")));

        expect(roundTripped.properties.size).toBe(0);
    });

});
