import {describe, expect, it} from "vitest";
import {Action} from "../src/api/actions/Action";
import {Job} from "../src/api/jobs/Job";

describe("Action", () => {

    it("accepts any job by default", () => {
        const action = new Action();

        expect(action.predicate(new Job("job-1"))).toBe(true);
    });

    it("returns the job unchanged by default", () => {
        const action = new Action();
        const job = new Job("job-1");

        expect(action.run(job)).toBe(job);
    });

    it("supports a custom predicate", () => {
        const action = new Action();
        action.predicate = (job) => job.properties.has("approved");

        expect(action.predicate(new Job("job-1"))).toBe(false);
        expect(action.predicate(new Job("job-2", new Map([["approved", true]])))).toBe(true);
    });

    it("supports a custom run function", () => {
        const action = new Action();
        action.run = (job) => {
            job.properties.set("touched", true);
            return job;
        };

        const result = action.run(new Job("job-1"));

        expect(result.properties.get("touched")).toBe(true);
    });

});
