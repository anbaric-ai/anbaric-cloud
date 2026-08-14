import {describe, expect, it} from "vitest";
import {JsonSchema, validateDocument} from "../src/api/documents/JsonSchema";

const customerSchema : JsonSchema = {
    type: "object",
    required: ["name", "age"],
    properties: {
        name: { type: "string" },
        age: { type: "integer" },
        tier: { type: "string", enum: ["free", "pro"] },
        tags: { type: "array", items: { type: "string" } },
        address: {
            type: "object",
            required: ["city"],
            properties: { city: { type: "string" } },
        },
    },
};

describe("validateDocument", () => {

    it("accepts a document matching the schema", () => {
        const document = { name: "Ada", age: 36, tier: "pro", tags: ["vip"], address: { city: "London" } };

        expect(validateDocument(document, customerSchema)).toEqual([]);
    });

    it("rejects a document of the wrong type", () => {
        expect(validateDocument("not an object", customerSchema)).toEqual([
            "$ should be object but was string",
        ]);
    });

    it("rejects missing required properties", () => {
        expect(validateDocument({ name: "Ada" }, customerSchema)).toEqual([
            "$.age is required",
        ]);
    });

    it("rejects properties of the wrong type", () => {
        expect(validateDocument({ name: "Ada", age: "old" }, customerSchema)).toEqual([
            "$.age should be integer but was string",
        ]);
    });

    it("rejects values outside an enum", () => {
        expect(validateDocument({ name: "Ada", age: 36, tier: "platinum" }, customerSchema)).toEqual([
            '$.tier must be one of ["free","pro"]',
        ]);
    });

    it("validates array items individually", () => {
        expect(validateDocument({ name: "Ada", age: 36, tags: ["ok", 7] }, customerSchema)).toEqual([
            "$.tags[1] should be string but was integer",
        ]);
    });

    it("validates nested objects with paths", () => {
        expect(validateDocument({ name: "Ada", age: 36, address: {} }, customerSchema)).toEqual([
            "$.address.city is required",
        ]);
    });

    it("accepts integers where numbers are expected", () => {
        expect(validateDocument(3, { type: "number" })).toEqual([]);
    });

    it("collects multiple violations", () => {
        const violations = validateDocument({ age: "old", tier: "platinum" }, customerSchema);

        expect(violations).toHaveLength(3);
    });

});
