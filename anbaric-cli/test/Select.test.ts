import {describe, expect, it} from "vitest";
import {reduceSelection, renderSelection, SelectOutcome, SelectState} from "../src/ui/Select";

const UP = "\x1b[A";
const DOWN = "\x1b[B";
const ENTER = "\r";
const BACKSPACE = "\x7f";

const initialState = () : SelectState => ({
    options: [
        { label: "Local Dev", value: "http://localhost:8787" },
        { label: "Anbaric Cloud", value: "https://cloud.anbaric.ai" },
        { label: "Other:", editable: true },
    ],
    highlighted: 0,
    typed: "",
});

const after = (state : SelectState, ...inputs : Array<string>) : SelectOutcome =>
    inputs.reduce((outcome : SelectOutcome, input) => reduceSelection(outcome.state, input), { state });

describe("reduceSelection", () => {

    it("moves the highlight down and up", () => {
        expect(after(initialState(), DOWN).state.highlighted).toBe(1);
        expect(after(initialState(), DOWN, DOWN, UP).state.highlighted).toBe(1);
    });

    it("wraps the highlight at both ends", () => {
        expect(after(initialState(), UP).state.highlighted).toBe(2);
        expect(after(initialState(), DOWN, DOWN, DOWN).state.highlighted).toBe(0);
    });

    it("chooses the highlighted option's value on enter", () => {
        expect(after(initialState(), ENTER).chosen).toBe("http://localhost:8787");
        expect(after(initialState(), DOWN, ENTER).chosen).toBe("https://cloud.anbaric.ai");
    });

    it("collects typed characters when the editable option is highlighted", () => {
        const outcome = after(initialState(), UP, "h", "i");

        expect(outcome.state.typed).toBe("hi");
    });

    it("ignores typed characters on non-editable options", () => {
        expect(after(initialState(), "h", "i").state.typed).toBe("");
    });

    it("supports backspace while typing", () => {
        expect(after(initialState(), UP, "h", "i", BACKSPACE).state.typed).toBe("h");
    });

    it("chooses the typed value on enter for the editable option", () => {
        const inputs = [UP, ..."http://my-platform:9999", ENTER];

        expect(after(initialState(), ...inputs).chosen).toBe("http://my-platform:9999");
    });

    it("does not choose the editable option while nothing is typed", () => {
        expect(after(initialState(), UP, ENTER).chosen).toBeUndefined();
    });

});

describe("renderSelection", () => {

    it("marks the highlighted option", () => {
        const lines = renderSelection(initialState()).split("\n");

        expect(lines[0]).toContain("❯ Local Dev");
        expect(lines[1].startsWith("  ")).toBe(true);
    });

    it("shows typed text on the editable option", () => {
        const state = { ...initialState(), highlighted: 2, typed: "http://x" };

        expect(renderSelection(state).split("\n")[2]).toContain("Other: http://x");
    });

    it("shows hints", () => {
        const state = initialState();
        state.options[0].hint = "● running";

        expect(renderSelection(state).split("\n")[0]).toContain("● running");
    });

});
