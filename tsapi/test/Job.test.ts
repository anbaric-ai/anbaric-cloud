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

    });

});
