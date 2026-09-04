import {describe, expect, it} from "vitest";
import {Code} from "../src/actors/Code.js";

describe("Code", () => {

    it("is a CODE actor with an id and a default role", () => {
        const actor = new Code("stamper");

        expect(actor.type).toBe("CODE");
        expect(actor.id).toBe("stamper");
        expect(actor.roles).toEqual(["code"]);
    });

    it("keeps a given role", () => {
        expect(new Code("stamper", "backoffice").roles).toEqual(["backoffice"]);
    });

});
