import {describe, expect, it} from "vitest";
import {Job} from "anbaric-tsapi";
import {Code} from "../src/actors/Code";

describe("Code", () => {

    it("is a CODE actor with an id and a default role", () => {
        const actor = new Code("stamper", async () => new Map());

        expect(actor.type).toBe("CODE");
        expect(actor.id).toBe("stamper");
        expect(actor.role).toBe("code");
    });

    it("keeps a given role", () => {
        expect(new Code("stamper", async () => new Map(), "backoffice").role).toBe("backoffice");
    });

    it("runs its function against a job", async () => {
        const actor = new Code("stamper", async (job) => new Map([["seen", job.id]]));

        expect(await actor.run(new Job("job-1", new Map(), "start"))).toEqual(new Map([["seen", "job-1"]]));
    });

});
