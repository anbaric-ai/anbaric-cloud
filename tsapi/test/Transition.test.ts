import {describe, expect, it} from "vitest";
import {Job} from "../src/api/jobs/Job.js";
import {Transition} from "../src/api/transitions/Transition.js";

describe("Transition", () => {

    it("stores the target state", () => {
        const transition = new Transition("done", () => true);

        expect(transition.to).toBe("done");
    });

    it("stores the predicate", () => {
        const onlyApproved = (job : Job) => job.properties.has("approved");
        const transition = new Transition("done", onlyApproved);

        expect(transition.predicate).toBe(onlyApproved);
    });

});
