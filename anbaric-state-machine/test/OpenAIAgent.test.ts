import {describe, expect, it, vi} from "vitest";
import {OpenAIAgent, OpenAIClient} from "../src/actors/agents/OpenAIAgent.js";

const jsonResponse = (body : any, ok : boolean = true, status : number = 200) => ({
    ok,
    status,
    json: async () => body,
}) as Response;

const outputSchema = {
    type: "object",
    properties: { sentiment: { type: "string" }, score: { type: "number" } },
};

describe("OpenAIAgent", () => {

    it("is an AGENT actor holding an OpenAI client", () => {
        const agent = new OpenAIAgent("gpt", "assistant", { apiKey: "sk-test", model: "gpt-5" });

        expect(agent.type).toBe("AGENT");
        expect(agent.client).toBeInstanceOf(OpenAIClient);
    });

    it("requests structured output with a strictified schema and parses the content", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) =>
            jsonResponse({ choices: [{ message: { content: JSON.stringify({ sentiment: "good", score: 9 }) } }] }));
        const agent = new OpenAIAgent("gpt", "assistant",
            { apiKey: "sk-test", model: "gpt-5", baseUrl: "https://api.openai.test/v1" }, fetchFn);

        const output = await agent.client.generate({
            messages: [{ role: "system", content: "Judge it." }],
            outputSchema,
        });

        expect(output).toEqual({ sentiment: "good", score: 9 });
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://api.openai.test/v1/chat/completions");
        expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
        const sent = JSON.parse(init.body as string);
        expect(sent.model).toBe("gpt-5");
        expect(sent.response_format.type).toBe("json_schema");
        expect(sent.response_format.json_schema.strict).toBe(true);
        expect(sent.response_format.json_schema.schema.additionalProperties).toBe(false);
        expect(sent.response_format.json_schema.schema.required).toEqual(["sentiment", "score"]);
    });

    it("throws a clear error on a non-2xx response", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) =>
            jsonResponse({ error: { message: "bad key" } }, false, 401));
        const agent = new OpenAIAgent("gpt", "assistant", { apiKey: "nope", model: "gpt-5" }, fetchFn);

        await expect(agent.client.generate({ messages: [], outputSchema }))
            .rejects.toThrowError("The OpenAI request failed with status 401: bad key");
    });

});
