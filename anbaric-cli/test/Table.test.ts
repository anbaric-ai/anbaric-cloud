import {describe, expect, it} from "vitest";
import {renderTable} from "../src/ui/Table";

describe("renderTable", () => {

    it("aligns columns to the widest cell", () => {
        const table = renderTable(["NAME", "STATE"], [
            ["a-long-name", "ok"],
            ["b", "running"],
        ]);

        const lines = table.split("\n");
        expect(lines[0]).toBe("NAME          STATE");
        expect(lines[2]).toBe("a-long-name   ok");
        expect(lines[3]).toBe("b             running");
    });

    it("ignores ansi escape codes when measuring widths", () => {
        const table = renderTable(["NAME"], [["\x1b[32mgreen\x1b[39m"]]);

        const lines = table.split("\n");
        expect(lines[2]).toBe("\x1b[32mgreen\x1b[39m");
    });

    it("renders a separator between header and rows", () => {
        const lines = renderTable(["AB"], [["x"]]).split("\n");

        expect(lines[1]).toBe("──");
    });

});
