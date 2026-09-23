import {describe, expect, it} from "vitest";
import {Action, Actor, Await, PropertyDefinition, State, Transition, WorkflowDefinition} from "../src/index.js";

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

    it("keeps awaits apart from actions, with what each waits on", () => {
        const state = new State("review", [
            new Await("Wait", "HUMAN", "A manager decides"), new Action("Triage", actor), new Await("Callback"),
        ]);

        const definition = WorkflowDefinition.describe(undefined, "wf", "review", [state], []);

        expect(definition.states[0].actions.map(action => action.name)).toEqual(["Triage"]);
        expect(definition.states[0].awaits).toEqual([
            { name: "Wait", description: "A manager decides", waitingFor: "HUMAN" },
            { name: "Callback", description: "" },
        ]);
    });

    // So the console can show what a transition tests, not just where it goes.
    it("records a transition's predicate as its own source", () => {
        const state = new State("open", [], [new Transition("closed", (job) => job.properties.get("done") === true)]);

        const definition = WorkflowDefinition.describe(undefined, "wf", "open", [state], []);

        expect(definition.states[0].transitions[0].predicate).toContain('properties.get("done")');
    });

    it("leaves the predicate out of an unguarded transition, which always fires", () => {
        const state = new State("open", [], [new Transition("closed")]);

        const definition = WorkflowDefinition.describe(undefined, "wf", "open", [state], []);

        expect(definition.states[0].transitions[0]).toEqual({ to: "closed" });
    });

    it("carries a property's example so tools can prefill a new job", () => {
        const email = new PropertyDefinition("email");
        email.required = true;
        email.example = "someone@example.com";

        const definition = WorkflowDefinition.describe(undefined, "wf", "open", [new State("open")], [email]);

        expect(definition.dataSchema).toEqual([
            { id: "email", required: true, example: "someone@example.com" },
        ]);
    });

    it("leaves the example out entirely when a property has none", () => {
        const definition = WorkflowDefinition.describe(
            undefined, "wf", "open", [new State("open")], [new PropertyDefinition("notes")]);

        expect(definition.dataSchema).toEqual([{ id: "notes", required: false }]);
    });

});
