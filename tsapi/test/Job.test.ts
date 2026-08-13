import {describe, expect, it} from "vitest";
import {Job} from "../src/api/jobs/Job";

describe("Job", () => {

    it("stores the given id", () => {
        const job = new Job("job-1");

        expect(job.id).toBe("job-1");
    });

    it("stores the given properties map", () => {
        const properties = new Map<string, any>([["colour", "red"]]);
        const job = new Job("job-1", properties);

        expect(job.properties).toBe(properties);
    });

    it("defaults properties to an empty map", () => {
        const job = new Job("job-1");

        expect(job.properties.size).toBe(0);
    });

    it("has no state initially", () => {
        const job = new Job("job-1");

        expect(job.stateId).toBeUndefined();
    });

    it("exposes the state set via setState", () => {
        const job = new Job("job-1");

        job.setState("review");

        expect(job.stateId).toBe("review");
    });

    it("overwrites a previously set state", () => {
        const job = new Job("job-1");

        job.setState("review");
        job.setState("done");

        expect(job.stateId).toBe("done");
    });

});
