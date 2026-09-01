import {describe, expect, it, vi} from "vitest";
import {Agent, AgentRequest, PropertyDefinition, State} from "anbaric-tsapi";
import {StateMachine} from "../src/StateMachine";
import {InMemoryJobPersistence} from "../src/persistence/InMemoryJobPersistence";
import {InMemoryQueue} from "../src/scheduling/InMemoryQueue";
import {RemoteLLMAgenticAction} from "../src/actions/RemoteLLMAgenticAction";

class FixedClient extends Agent.Client {

    async generate(_request : AgentRequest) : Promise<Record<string, any>> {
        return { summary: "all clear" };
    }

}

describe("RemoteLLMAgenticAction inside a StateMachine", () => {

    it("lets an agent generate the properties written to a job", async () => {
        const agent = new Agent("gpt", "assistant", new FixedClient());
        const action = new RemoteLLMAgenticAction("Summarise", agent,
            [{ role: "system", content: "Summarise the case." }],
            { type: "object", properties: { summary: { type: "string" } } });

        const auditor = { audit: vi.fn(async () => {}) } as any;
        const persistence = new InMemoryJobPersistence(auditor);
        const machine = new StateMachine("reviews", [new State("start")], "start",
            [new PropertyDefinition("summary")], persistence, new InMemoryQueue());

        const job = await machine.startJob();
        await machine.executeAction(job.id, action);

        expect((await persistence.retrieve(job.id, agent)).properties.get("summary")).toBe("all clear");
        expect(auditor.audit).toHaveBeenCalledWith("", "job", job.id, agent, ["UPDATE_PROPERTIES"], expect.any(String), expect.anything());
    });

});
