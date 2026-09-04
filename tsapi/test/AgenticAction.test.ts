import {describe, expect, it} from "vitest";
import {Agent} from "../src/api/actors/agents/Agent.js";
import {AgentRequest} from "../src/api/actors/agents/AgentRequest.js";
import {AgenticAction} from "../src/api/actions/AgenticAction.js";
import {Job} from "../src/api/jobs/Job.js";

class RecordingClient extends Agent.Client {

    lastRequest? : AgentRequest;

    async generate(request : AgentRequest) : Promise<Record<string, any>> {
        this.lastRequest = request;
        return { reviewed: true, score: 7 };
    }

}

class EchoAgenticAction extends AgenticAction {

    protected requestFor(job : Job) : AgentRequest {
        return { messages: [{ role: "user", content: job.id }], outputSchema: { type: "object" } };
    }

}

const agentWith = (client : Agent.Client) => new Agent("reviewer", "assistant", client);

describe("AgenticAction", () => {

    it("uses the agent as its actor", () => {
        const agent = agentWith(new RecordingClient());
        const action = new EchoAgenticAction("Review", agent);

        expect(action.actor).toBe(agent);
    });

    it("generates the property map from the agent's client", async () => {
        const action = new EchoAgenticAction("Review", agentWith(new RecordingClient()));

        expect(await action.run(new Job("job-1", new Map(), "start")))
            .toEqual(new Map<string, any>([["reviewed", true], ["score", 7]]));
    });

    it("builds the request from the job", async () => {
        const client = new RecordingClient();
        const action = new EchoAgenticAction("Review", agentWith(client));

        await action.run(new Job("job-42", new Map(), "start"));

        expect(client.lastRequest?.messages).toEqual([{ role: "user", content: "job-42" }]);
    });

});
