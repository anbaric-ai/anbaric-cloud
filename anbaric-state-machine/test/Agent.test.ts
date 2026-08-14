import {describe, expect, it} from "vitest";
import {Agent} from "../src/actors/Agent";

describe("Agent", () => {

    it("is an AGENT actor with an id and role", () => {
        const actor = new Agent("helper", "assistant");

        expect(actor.type).toBe("AGENT");
        expect(actor.id).toBe("helper");
        expect(actor.role).toBe("assistant");
    });

});
