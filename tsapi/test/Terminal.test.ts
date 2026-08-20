import {describe, expect, it} from "vitest";
import {State} from "../src/api/states/State";
import {Terminal} from "../src/api/states/Terminal";

describe("Terminal", () => {

    it("is a terminal State", () => {
        const terminal = new Terminal("finished", Terminal.Outcome.SUCCESS);

        expect(terminal).toBeInstanceOf(State);
        expect(terminal.isTerminal).toBe(true);
    });

    it("keeps the given id and outcome", () => {
        const terminal = new Terminal("failed", Terminal.Outcome.FAILURE);

        expect(terminal.id).toBe("failed");
        expect(terminal.outcome).toBe(Terminal.Outcome.FAILURE);
    });

    it("has no actions or transitions", () => {
        const terminal = new Terminal("finished", Terminal.Outcome.SUCCESS);

        expect(terminal.actions).toEqual([]);
        expect(terminal.transitions).toEqual([]);
    });

});
