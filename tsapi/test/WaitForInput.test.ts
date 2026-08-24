import {describe, expect, it} from "vitest";
import {WaitForInput, serializeWaitForInput, deserializeWaitForInput} from "../src/index";

describe("WaitForInput", () => {

    it("round-trips through serialisation", () => {
        const wait = new WaitForInput(["a", "b"], "/resolve", new Map([["k", 1]]), "EXTERNAL_SYSTEM");

        const back = deserializeWaitForInput(serializeWaitForInput(wait));

        expect(back.fields).toEqual(["a", "b"]);
        expect(back.resolveUrl).toBe("/resolve");
        expect(back.metadataMap.get("k")).toBe(1);
        expect(back.waitingFor).toBe("EXTERNAL_SYSTEM");
    });

    it("serialises the metadata map to a plain object", () => {
        const serialized = serializeWaitForInput(new WaitForInput([], "", new Map([["k", "v"]])));

        expect(serialized.metadataMap).toEqual({ k: "v" });
    });

});
