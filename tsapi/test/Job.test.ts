import {describe, expect, it} from "vitest";
import {Job} from "../src/api/jobs/Job";
import {Transition} from "../src/api/transitions/Transition";

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

        expect(job.stateId).toBe("start");
    });

    it("has no workflow by default", () => {
        const job = new Job("job-1", new Map(), "start");

        expect(job.workflowId).toBeUndefined();
    });

    it("stores the given workflow id", () => {
        const job = new Job("job-1", new Map(), "start", "workflow-1");

        expect(job.workflowId).toBe("workflow-1");
    });

    describe("transition", () => {

        it("moves to the target state when the predicate accepts the job", () => {
            const job = new Job("job-1", new Map(), "start");

            const accepted = job.transition(new Transition("done", () => true));

            expect(accepted).toBe(true);
            expect(job.stateId).toBe("done");
        });

        it("stays put when the predicate rejects the job", () => {
            const job = new Job("job-1", new Map(), "start");

            const accepted = job.transition(new Transition("done", () => false));

            expect(accepted).toBe(false);
            expect(job.stateId).toBe("start");
        });

        it("evaluates the predicate against the job itself", () => {
            const job = new Job("job-1", new Map([["approved", true]]), "start");
            const whenApproved = new Transition("done", (candidate) => candidate.properties.get("approved") === true);

            expect(job.transition(whenApproved)).toBe(true);
            expect(job.stateId).toBe("done");
        });

        it("can transition repeatedly", () => {
            const job = new Job("job-1", new Map(), "start");

            job.transition(new Transition("review", () => true));
            job.transition(new Transition("done", () => true));

            expect(job.stateId).toBe("done");
        });

        it("records each transition with the acting workflow", () => {
            const job = new Job("job-1", new Map(), "start", "onboarding");

            job.transition(new Transition("review", () => true));

            expect(job.transitions).toEqual([{ from: "start", to: "review", actor: "onboarding" }]);
        });

        it("records the given actor over the default", () => {
            const job = new Job("job-1", new Map(), "start", "onboarding");

            job.transition(new Transition("review", () => true), "cli:chris laptop");

            expect(job.transitions).toEqual([{ from: "start", to: "review", actor: "cli:chris laptop" }]);
        });

        it("records nothing when the predicate rejects the job", () => {
            const job = new Job("job-1", new Map(), "start");

            job.transition(new Transition("done", () => false));

            expect(job.transitions).toEqual([]);
        });

        it("bumps lastUpdated when a transition is made", () => {
            const started = new Date("2026-08-14T10:00:00Z");
            const job = new Job("job-1", new Map(), "start", undefined, "system", started);

            job.transition(new Transition("done", () => true));

            expect(job.lastUpdated.getTime()).toBeGreaterThan(started.getTime());
        });

    });

    describe("metadata", () => {

        it("defaults startedBy to system and lastUpdated to startedAt", () => {
            const started = new Date("2026-08-14T10:00:00Z");
            const job = new Job("job-1", new Map(), "start", undefined, undefined, started);

            expect(job.startedBy).toBe("system");
            expect(job.startedAt).toBe(started);
            expect(job.lastUpdated).toBe(started);
            expect(job.transitions).toEqual([]);
        });

        it("keeps the given metadata", () => {
            const started = new Date("2026-08-14T10:00:00Z");
            const updated = new Date("2026-08-14T11:00:00Z");
            const history = [{ from: "start", to: "done", actor: "onboarding" }];
            const job = new Job("job-1", new Map(), "done", "onboarding", "chris", started, updated, history);

            expect(job.startedBy).toBe("chris");
            expect(job.lastUpdated).toBe(updated);
            expect(job.transitions).toBe(history);
        });

    });

});
