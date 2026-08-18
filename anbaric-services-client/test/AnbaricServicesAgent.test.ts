import {describe, expect, it, vi} from "vitest";
import {AnbaricServicesAgent, AnbaricServicesClient} from "../src/AnbaricServicesAgent";

const jsonResponse = (body : any, ok : boolean = true, status : number = 200) => ({
    ok,
    status,
    json: async () => body,
}) as Response;

const schema = { type: "object", properties: { risk: { type: "string" } } };

describe("AnbaricServicesAgent", () => {

    it("is an AGENT actor holding a legacy-services client", () => {
        const agent = new AnbaricServicesAgent("legacy", "assistant", { baseUrl: "https://svc.test" });

        expect(agent.type).toBe("AGENT");
        expect(agent.client).toBeInstanceOf(AnbaricServicesClient);
    });

    it("posts the JSON Schema to the agentic-actions endpoint and returns the output", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) =>
            jsonResponse({ output: { risk: "low" }, model: "gpt-5.4-mini" }));
        const agent = new AnbaricServicesAgent("legacy", "assistant",
            { baseUrl: "https://svc.test", apiKey: "key-1" }, fetchFn);

        const output = await agent.client.generate({
            messages: [{ role: "system", content: "Assess." }, { role: "user", content: "{\"age\":40}" }],
            outputSchema: schema,
        });

        expect(output).toEqual({ risk: "low" });
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe("https://svc.test/agentic-actions");
        expect((init.headers as Record<string, string>).authorization).toBe("Bearer key-1");
        const sent = JSON.parse(init.body as string);
        expect(sent.instructions).toBe("Assess.");
        expect(sent.outputSchema).toEqual(schema);
        expect(sent.input).toEqual([{ role: "user", content: "{\"age\":40}" }]);
    });

    it("throws a clear error when the service rejects the request", async () => {
        const fetchFn = vi.fn(async (_url : string, _init : RequestInit) =>
            jsonResponse({ error: "bad schema" }, false, 400));
        const agent = new AnbaricServicesAgent("legacy", "assistant", { baseUrl: "https://svc.test" }, fetchFn);

        await expect(agent.client.generate({ messages: [], outputSchema: schema }))
            .rejects.toThrowError("The Anbaric agent service failed with status 400: bad schema");
    });

});
