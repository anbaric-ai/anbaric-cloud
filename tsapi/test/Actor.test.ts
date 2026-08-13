import {describe, expect, it} from "vitest";
import {Actor} from "../src/api/actors/Actor";

describe("Actor", () => {

    it("constructs", () => {
        expect(new Actor()).toBeInstanceOf(Actor);
    });

});
