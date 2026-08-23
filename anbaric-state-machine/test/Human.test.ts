import {describe, expect, it} from "vitest";
import {Human} from "../src/actors/Human";

describe("Human", () => {

    it("is a HUMAN actor with an id and roles", () => {
        const actor = new Human("chris", "admin");

        expect(actor.type).toBe("HUMAN");
        expect(actor.id).toBe("chris");
        expect(actor.roles).toEqual(["admin"]);
    });

    it("accepts multiple roles", () => {
        expect(new Human("chris", ["admin", "reviewer"]).roles).toEqual(["admin", "reviewer"]);
    });

});
