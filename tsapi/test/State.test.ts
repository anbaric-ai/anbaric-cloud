import {describe, expect, it} from "vitest";
import {Action} from "../src/api/actions/Action";
import {State} from "../src/api/states/State";

describe("State", () => {

    it("stores the given id", () => {
        const state = new State("draft");

        expect(state.id).toBe("draft");
    });

    it("defaults to no actions", () => {
        const state = new State("draft");

        expect(state.actions).toEqual([]);
    });

    it("keeps the given actions", () => {
        const actions = [new Action(), new Action()];
        const state = new State("draft", actions);

        expect(state.actions).toBe(actions);
    });

});
