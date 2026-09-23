import {describe, expect, it, vi} from "vitest";
import {GeminiAgent, GeminiClient, geminiSchema} from "../src/actors/agents/GeminiAgent.js";

const jsonResponse = (body : any, ok : boolean = true, status : number = 200) => ({
    ok,
    status,
    json: async () => body,
}) as Response;

const outputSchema = {
    type: "object",
    properties: { sentiment: { type: "string", enum: ["good", "bad"] }, score: { type: "number" } },
    required: ["sentiment"],
};

const generated = (value : object) =>
    jsonResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] });

describe("geminiSchema", () => {

    it("upper-cases types, recursing through properties and items", () => {
        expect(geminiSchema({ type: "array", items: { type: "object", properties: { n: { type: "integer" } } } }))
            .toEqual({ type: "ARRAY", items: { type: "OBJECT", properties: { n: { type: "INTEGER" } } } });
    });

    it("carries the keywords Gemini knows and drops the ones it rejects", () => {
        expect(geminiSchema({
            type: "object",
            properties: { name: { type: "string", description: "who" } },
            required: ["name"],
            additionalProperties: false,
        })).toEqual({
            type: "OBJECT",
            required: ["name"],
            properties: { name: { type: "STRING", description: "who" } },
        });
    });

});

describe("GeminiAgent", () => {

    it("is an AGENT actor holding a Gemini client", () => {
        const agent = new GeminiAgent("gemini", "assistant", { apiKey: "key", model: "gemini-3-pro" });

        expect(agent.type).toBe("AGENT");
        expect(agent.client).toBeInstanceOf(GeminiClient);
    });

    it("asks the model for JSON against the converted schema and parses it", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) => generated({ sentiment: "good", score: 9 }));
        const agent = new GeminiAgent("gemini", "assistant",
            { apiKey: "key", model: "gemini-3-pro", baseUrl: "https://gemini.test/v1beta" }, fetchFn);

        const output = await agent.client.generate({
            messages: [
                { role: "system", content: "Judge it." },
                { role: "user", content: "lovely" },
                { role: "assistant", content: "noted" },
            ],
            outputSchema,
        });

        expect(output).toEqual({ sentiment: "good", score: 9 });
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://gemini.test/v1beta/models/gemini-3-pro:generateContent");
        // The key is a header, never a query parameter.
        expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("key");
        expect(url).not.toContain("key");

        const sent = JSON.parse(init.body as string);
        expect(sent.systemInstruction).toEqual({ parts: [{ text: "Judge it." }] });
        expect(sent.contents).toEqual([
            { role: "user", parts: [{ text: "lovely" }] },
            { role: "model", parts: [{ text: "noted" }] },
        ]);
        expect(sent.generationConfig.responseMimeType).toBe("application/json");
        expect(sent.generationConfig.responseSchema.type).toBe("OBJECT");
        expect(sent.generationConfig.responseSchema.properties.sentiment.enum).toEqual(["good", "bad"]);
    });

    it("leaves the system instruction out when the prompt has no system message", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) => generated({ sentiment: "good" }));
        const agent = new GeminiAgent("gemini", "assistant", { apiKey: "key", model: "gemini-3-pro" }, fetchFn);

        await agent.client.generate({ messages: [{ role: "user", content: "go" }], outputSchema });

        expect(JSON.parse(fetchFn.mock.calls[0][1].body as string).systemInstruction).toBeUndefined();
    });

    it("throws a clear error on a non-2xx response", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) =>
            jsonResponse({ error: { message: "API key not valid" } }, false, 400));
        const agent = new GeminiAgent("gemini", "assistant", { apiKey: "nope", model: "gemini-3-pro" }, fetchFn);

        await expect(agent.client.generate({ messages: [], outputSchema }))
            .rejects.toThrowError("The Gemini request failed with status 400: API key not valid");
    });

    it("throws when the response carried no candidate text", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) =>
            jsonResponse({ candidates: [{ finishReason: "SAFETY" }] }));
        const agent = new GeminiAgent("gemini", "assistant", { apiKey: "key", model: "gemini-3-pro" }, fetchFn);

        await expect(agent.client.generate({ messages: [], outputSchema }))
            .rejects.toThrowError("The Gemini response carried no structured content");
    });

});
