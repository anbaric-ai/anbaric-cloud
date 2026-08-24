import {describe, expect, it} from "vitest";
import {Await, Job} from "../src/index";

const job = () => new Job("job-1", new Map([["x", 1]]), "review");

describe("Await", () => {

    it("builds a WaitForInput from its fields and a static resolveUrl", () => {
        const step = new Await("Approve", "HUMAN");
        step.fields = ["approved"];
        step.resolveUrl = "/approve";

        const wait = step.waitForInput(job());

        expect(wait.fields).toEqual(["approved"]);
        expect(wait.resolveUrl).toBe("/approve");
        expect(wait.waitingFor).toBe("HUMAN");
    });

    it("derives the resolveUrl from a function of the job", () => {
        const step = new Await("Approve", "HUMAN");
        step.resolveUrl = (j) => `/approve?job=${j.id}`;

        expect(step.waitForInput(job()).resolveUrl).toBe("/approve?job=job-1");
    });

    it("carries the metadata it computes for the job", () => {
        const step = new Await("Approve");
        step.metadata = (j) => new Map([["state", j.state]]);

        expect(step.waitForInput(job()).metadataMap.get("state")).toBe("review");
    });

    it("has no actor - the party providing input is not known in advance", () => {
        expect("actor" in new Await("Approve")).toBe(false);
    });

});
