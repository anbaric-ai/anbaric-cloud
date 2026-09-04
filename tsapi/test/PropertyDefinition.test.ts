import {describe, expect, it} from "vitest";
import {PropertyDefinition} from "../src/api/jobs/PropertyDefinition.js";

describe("PropertyDefinition", () => {

    it("stores the given id", () => {
        const definition = new PropertyDefinition("age");

        expect(definition.id).toBe("age");
    });

    it("is not required by default", () => {
        const definition = new PropertyDefinition("age");

        expect(definition.required).toBe(false);
    });

    it("accepts any value by default", () => {
        const definition = new PropertyDefinition("age");

        expect(definition.validation(42)).toBe(true);
        expect(definition.validation(null)).toBe(true);
        expect(definition.validation("anything")).toBe(true);
    });

    it("supports a custom validation predicate", () => {
        const definition = new PropertyDefinition("age");
        definition.validation = (value) => typeof value === "number" && value >= 0;

        expect(definition.validation(42)).toBe(true);
        expect(definition.validation(-1)).toBe(false);
        expect(definition.validation("42")).toBe(false);
    });

    it("can be marked required", () => {
        const definition = new PropertyDefinition("age");
        definition.required = true;

        expect(definition.required).toBe(true);
    });

});
