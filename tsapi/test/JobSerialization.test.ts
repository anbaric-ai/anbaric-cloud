import {describe, expect, it} from "vitest";
import {Job} from "../src/api/jobs/Job";
import {deserializeJob, serializeJob} from "../src/api/jobs/JobSerialization";

describe("job serialization", () => {

    it("serializes id, state, and properties", () => {
        const job = new Job("job-1", new Map<string, any>([["colour", "red"], ["age", 42]]), "review");

        expect(serializeJob(job)).toMatchObject({
            id: "job-1",
            state: "review",
            properties: { colour: "red", age: 42 },
        });
    });

    it("serializes the job metadata", () => {
        const startedAt = new Date("2026-08-14T10:00:00Z");
        const updated = new Date("2026-08-14T11:30:00Z");
        const job = new Job("job-1", new Map(), "review", "onboarding", "app:crm", startedAt, updated,
            [{ from: "new", to: "review", actor: "onboarding" }]);

        expect(serializeJob(job)).toMatchObject({
            startedAt: "2026-08-14T10:00:00.000Z",
            startedBy: "app:crm",
            lastUpdated: "2026-08-14T11:30:00.000Z",
            transitions: [{ from: "new", to: "review", actor: "onboarding" }],
        });
    });

    it("round-trips the job metadata", () => {
        const startedAt = new Date("2026-08-14T10:00:00Z");
        const job = new Job("job-1", new Map(), "review", "onboarding", "app:crm", startedAt, startedAt,
            [{ from: "new", to: "review", actor: "onboarding" }]);

        const roundTripped = deserializeJob(serializeJob(job));

        expect(roundTripped.startedAt).toEqual(startedAt);
        expect(roundTripped.startedBy).toBe("app:crm");
        expect(roundTripped.lastUpdated).toEqual(startedAt);
        expect(roundTripped.transitions).toEqual([{ from: "new", to: "review", actor: "onboarding" }]);
    });

    it("fills sensible defaults when deserializing a legacy payload", () => {
        const job = deserializeJob({ id: "job-1", state: "review", properties: {} });

        expect(job.startedBy).toBe("system");
        expect(job.startedAt).toBeInstanceOf(Date);
        expect(job.lastUpdated).toEqual(job.startedAt);
        expect(job.transitions).toEqual([]);
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

    it("round-trips the workflow id", () => {
        const roundTripped = deserializeJob(serializeJob(new Job("job-1", new Map(), "start", "workflow-1")));

        expect(roundTripped.workflowId).toBe("workflow-1");
    });

    it("round-trips a job without a workflow id", () => {
        const roundTripped = deserializeJob(serializeJob(new Job("job-1", new Map(), "start")));

        expect(roundTripped.workflowId).toBeUndefined();
    });

});
