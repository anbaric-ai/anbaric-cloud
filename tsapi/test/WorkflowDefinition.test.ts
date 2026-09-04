import {describe, expect, it} from "vitest";
import {Action, Actor, Await, State, Transition, WorkflowDefinition} from "../src/index.js";

const actor : Actor = { id: "bot", type: "CODE", roles: ["reviewer"] };

describe("WorkflowDefinition.describe", () => {

    it("captures each action with its actor identity", () => {
        const state = new State("open", [new Action("Triage", actor)], [new Transition("closed", () => true)]);

        const definition = WorkflowDefinition.describe("crm", "wf", "open", [state], []);

        expect(definition.appId).toBe("crm");
        expect(definition.workflowId).toBe("wf");
        expect(definition.startState).toBe("open");
        expect(definition.states[0].actions).toEqual([
            { name: "Triage", description: "", actor: { id: "bot", type: "CODE", roles: ["reviewer"] } },
        ]);
        expect(definition.states[0].transitions).toEqual([{ to: "closed" }]);
    });

    it("omits awaits from the graph - they are pause points, not actors acting", () => {
        const state = new State("review", [new Await("Wait", "HUMAN"), new Action("Triage", actor)]);

        const definition = WorkflowDefinition.describe(undefined, "wf", "review", [state], []);

        expect(definition.states[0].actions).toHaveLength(1);
        expect(definition.states[0].actions[0].name).toBe("Triage");
    });

});
