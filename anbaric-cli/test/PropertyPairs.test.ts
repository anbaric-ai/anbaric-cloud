import {describe, expect, it} from "vitest";
import {parsePropertyPairs} from "../src/PropertyPairs";

describe("parsePropertyPairs", () => {

    it("parses plain strings", () => {
        expect(parsePropertyPairs(["name=Ada Lovelace"])).toEqual({ name: "Ada Lovelace" });
    });

    it("parses JSON values for numbers, booleans, and null", () => {
        expect(parsePropertyPairs(["age=42", "active=true", "notes=null"]))
            .toEqual({ age: 42, active: true, notes: null });
    });

    it("keeps values containing equals signs intact", () => {
        expect(parsePropertyPairs(["formula=a=b+c"])).toEqual({ formula: "a=b+c" });
    });

    it("parses multiple pairs", () => {
        expect(parsePropertyPairs(["a=1", "b=two"])).toEqual({ a: 1, b: "two" });
    });

    it("rejects arguments without a key", () => {
        expect(() => parsePropertyPairs(["=oops"])).toThrowError('"=oops" is not a property=value pair');
        expect(() => parsePropertyPairs(["oops"])).toThrowError('"oops" is not a property=value pair');
    });

});
