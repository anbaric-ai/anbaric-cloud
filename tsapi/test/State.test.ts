import {describe, expect, it} from "vitest";
import {Action} from "../src/api/actions/Action";
import {Actor} from "../src/api/actors/Actor";
import {State} from "../src/api/states/State";
import {Transition} from "../src/api/transitions/Transition";

const human : Actor = { type: "HUMAN", id: "chris", role: "admin" };

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
        const actions = [new Action("Approve", human), new Action("Reject", human)];
        const state = new State("draft", actions);

        expect(state.actions).toBe(actions);
    });

    it("subscribes further actions", () => {
        const state = new State("draft");
        const action = new Action("Approve", human);

        state.subscribe(action);

        expect(state.actions).toEqual([action]);
    });

    it("defaults to no transitions", () => {
        const state = new State("draft");

        expect(state.transitions).toEqual([]);
    });

    it("keeps the given transitions", () => {
        const transitions = [new Transition("review", () => true)];
        const state = new State("draft", [], transitions);

        expect(state.transitions).toBe(transitions);
    });

    it("is not terminal by default", () => {
        const state = new State("draft");

        expect(state.isTerminal).toBe(false);
    });

});
