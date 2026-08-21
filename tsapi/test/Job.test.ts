import {describe, expect, it} from "vitest";
import {Job} from "../src/api/jobs/Job";

describe("Job", () => {

    it("stores the given id", () => {
        const job = new Job("job-1", new Map(), "start");

        expect(job.id).toBe("job-1");
    });

    it("stores the given properties map", () => {
        const properties = new Map<string, any>([["colour", "red"]]);
        const job = new Job("job-1", properties, "start");

        expect(job.properties).toBe(properties);
    });

    it("starts in the given initial state", () => {
        const job = new Job("job-1", new Map(), "start");

        expect(job.state).toBe("start");
    });

    it("has no workflow by default", () => {
        const job = new Job("job-1", new Map(), "start");

        expect(job.workflowId).toBeUndefined();
    });

    it("stores the given workflow id", () => {
        const job = new Job("job-1", new Map(), "start", "workflow-1");

        expect(job.workflowId).toBe("workflow-1");
    });

    describe("metadata", () => {

        it("defaults startedBy to system and lastUpdated to startedAt", () => {
            const started = new Date("2026-08-14T10:00:00Z");
            const job = new Job("job-1", new Map(), "start", undefined, undefined, started);

            expect(job.startedBy).toBe("system");
            expect(job.startedAt).toBe(started);
            expect(job.lastUpdated).toBe(started);
        });

        it("keeps the given metadata", () => {
            const started = new Date("2026-08-14T10:00:00Z");
            const updated = new Date("2026-08-14T11:00:00Z");
            const job = new Job("job-1", new Map(), "done", "onboarding", "chris", started, updated);

            expect(job.startedBy).toBe("chris");
            expect(job.lastUpdated).toBe(updated);
        });

        it("is not killed by default, and keeps the given killed flag", () => {
            expect(new Job("job-1", new Map(), "start").killed).toBe(false);

            const started = new Date("2026-08-14T10:00:00Z");
            expect(new Job("job-1", new Map(), "start", undefined, undefined, started, started, true).killed).toBe(true);
        });

    });

});
