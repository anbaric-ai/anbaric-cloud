import {describe, expect, it} from "vitest";
import {Agent, AgentRequest, Job} from "anbaric-tsapi";
import {RemoteLLMAgenticAction} from "../src/actions/RemoteLLMAgenticAction";

class RecordingClient extends Agent.Client {

    lastRequest? : AgentRequest;

    async generate(request : AgentRequest) : Promise<Record<string, any>> {
        this.lastRequest = request;
        return { risk: "low" };
    }

}

const messages = [{ role: "system" as const, content: "Assess the applicant." }];
const schema = { type: "object", properties: { risk: { type: "string" } } };

describe("RemoteLLMAgenticAction", () => {

    it("appends the job's properties as the final user message", async () => {
        const client = new RecordingClient();
        const action = new RemoteLLMAgenticAction("Assess", new Agent("gpt", "assistant", client), messages, schema);

        await action.run(new Job("job-1", new Map([["age", 40]]), "start"));

        expect(client.lastRequest?.messages).toEqual([
            { role: "system", content: "Assess the applicant." },
            { role: "user", content: JSON.stringify({ age: 40 }) },
        ]);
        expect(client.lastRequest?.outputSchema).toBe(schema);
    });

    it("returns the generated properties as a map", async () => {
        const action = new RemoteLLMAgenticAction("Assess",
            new Agent("gpt", "assistant", new RecordingClient()), messages, schema);

        expect(await action.run(new Job("job-1", new Map(), "start")))
            .toEqual(new Map([["risk", "low"]]));
    });

});
