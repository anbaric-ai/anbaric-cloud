import {describe, expect, it} from "vitest";
import {Agent} from "../src/api/actors/agents/Agent";
import {AgentRequest} from "../src/api/actors/agents/AgentRequest";

class StubClient extends Agent.Client {

    async generate(_request : AgentRequest) : Promise<Record<string, any>> {
        return { ok: true };
    }

}

describe("Agent", () => {

    it("is an AGENT actor with an id and role", () => {
        const agent = new Agent("helper", "assistant", new StubClient());

        expect(agent.type).toBe("AGENT");
        expect(agent.id).toBe("helper");
        expect(agent.role).toBe("assistant");
    });

    it("holds a client that carries the functional detail", async () => {
        const agent = new Agent("helper", "assistant", new StubClient());

        expect(await agent.client.generate({ messages: [], outputSchema: {} })).toEqual({ ok: true });
    });

});
