import {describe, expect, it} from "vitest";
import {unstorableCharacterIn} from "../../src/hosting/UnstorableCharacter";

describe("unstorableCharacterIn", () => {

    it("finds nothing in values without a NUL character", () => {
        expect(unstorableCharacterIn({ title: "fine", count: 3, tags: ["a", null], nested: { ok: true } })).toBeUndefined();
        expect(unstorableCharacterIn(undefined)).toBeUndefined();
    });

    it("names the path of a string holding a NUL character", () => {
        expect(unstorableCharacterIn({ items: [{ title: "fine" }, { title: "costs rise\u0000" }] })).toBe("items[1].title");
    });

    it("names a key holding a NUL character", () => {
        expect(unstorableCharacterIn({ scores: { "bad\u0000key": 1 } })).toBe("scores.bad\u0000key");
    });

    it("reports a top-level string by an empty path", () => {
        expect(unstorableCharacterIn("\u0000")).toBe("");
    });

});
