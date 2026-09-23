import {describe, expect, it, vi} from "vitest";
import {AnthropicAgent, AnthropicClient} from "../src/actors/agents/AnthropicAgent.js";

const jsonResponse = (body : any, ok : boolean = true, status : number = 200) => ({
    ok,
    status,
    json: async () => body,
}) as Response;

const outputSchema = {
    type: "object",
    properties: { sentiment: { type: "string" }, score: { type: "number" } },
};

const toolUse = (input : object) =>
    jsonResponse({ content: [{ type: "text", text: "thinking" }, { type: "tool_use", name: "properties", input }] });

describe("AnthropicAgent", () => {

    it("is an AGENT actor holding an Anthropic client", () => {
        const agent = new AnthropicAgent("claude", "assistant", { apiKey: "sk-test", model: "claude-opus-5" });

        expect(agent.type).toBe("AGENT");
        expect(agent.client).toBeInstanceOf(AnthropicClient);
    });

    it("lifts system messages into the system field and leaves the rest as turns", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) => toolUse({ sentiment: "good", score: 9 }));
        const agent = new AnthropicAgent("claude", "assistant",
            { apiKey: "sk-test", model: "claude-opus-5", baseUrl: "https://api.anthropic.test/v1" }, fetchFn);

        const output = await agent.client.generate({
            messages: [
                { role: "system", content: "Judge it." },
                { role: "system", content: "Be terse." },
                { role: "user", content: "{\"text\":\"lovely\"}" },
            ],
            outputSchema,
        });

        expect(output).toEqual({ sentiment: "good", score: 9 });
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://api.anthropic.test/v1/messages");
        const headers = init.headers as Record<string, string>;
        expect(headers["x-api-key"]).toBe("sk-test");
        expect(headers["anthropic-version"]).toBe("2023-06-01");
        const sent = JSON.parse(init.body as string);
        expect(sent.system).toBe("Judge it.\n\nBe terse.");
        expect(sent.messages).toEqual([{ role: "user", content: "{\"text\":\"lovely\"}" }]);
    });

    it("asks for structured output by forcing a single tool carrying the schema", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) => toolUse({ sentiment: "good", score: 9 }));
        const agent = new AnthropicAgent("claude", "assistant", { apiKey: "sk-test", model: "claude-opus-5" }, fetchFn);

        await agent.client.generate({ messages: [{ role: "user", content: "go" }], outputSchema });

        const sent = JSON.parse(fetchFn.mock.calls[0][1].body as string);
        expect(sent.tools).toEqual([{
            name: "properties",
            description: "Return the properties to write to the job.",
            input_schema: outputSchema,
        }]);
        expect(sent.tool_choice).toEqual({ type: "tool", name: "properties" });
        // The Messages API requires a token budget, so one is always sent.
        expect(sent.max_tokens).toBe(4096);
    });

    it("carries a configured token budget and api version", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) => toolUse({ sentiment: "ok", score: 5 }));
        const agent = new AnthropicAgent("claude", "assistant",
            { apiKey: "sk-test", model: "claude-opus-5", maxTokens: 512, version: "2026-01-01" }, fetchFn);

        await agent.client.generate({ messages: [], outputSchema });

        const [, init] = fetchFn.mock.calls[0];
        expect((init.headers as Record<string, string>)["anthropic-version"]).toBe("2026-01-01");
        expect(JSON.parse(init.body as string).max_tokens).toBe(512);
    });

    it("throws a clear error on a non-2xx response", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) =>
            jsonResponse({ error: { message: "bad key" } }, false, 401));
        const agent = new AnthropicAgent("claude", "assistant", { apiKey: "nope", model: "claude-opus-5" }, fetchFn);

        await expect(agent.client.generate({ messages: [], outputSchema }))
            .rejects.toThrowError("The Anthropic request failed with status 401: bad key");
    });

    it("throws when the model answered with prose instead of calling the tool", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) =>
            jsonResponse({ content: [{ type: "text", text: "I'd rather not" }] }));
        const agent = new AnthropicAgent("claude", "assistant", { apiKey: "sk-test", model: "claude-opus-5" }, fetchFn);

        await expect(agent.client.generate({ messages: [], outputSchema }))
            .rejects.toThrowError("The Anthropic response carried no structured content");
    });

});
