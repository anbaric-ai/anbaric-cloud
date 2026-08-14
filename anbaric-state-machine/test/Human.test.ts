import {describe, expect, it} from "vitest";
import {Human} from "../src/actors/Human";

describe("Human", () => {

    it("is a HUMAN actor with an id and role", () => {
        const actor = new Human("chris", "admin");

        expect(actor.type).toBe("HUMAN");
        expect(actor.id).toBe("chris");
        expect(actor.role).toBe("admin");
    });

});
