import {afterEach, describe, expect, it, vi} from "vitest";
import {GatewayDocModel} from "../../src/docs/GatewayDocModel";

const context = { appName: "crm", files: [{ path: "src/machine.ts", content: "code" }], truncated: false };

const jsonResponse = (body : unknown, ok = true, status = 200) : Response =>
    ({ ok, status, json: async () => body } as unknown as Response);

describe("GatewayDocModel", () => {

    afterEach(() => vi.restoreAllMocks());

    it("posts to /chat/completions with a json_schema response format and returns the docs", async () => {
        let sentUrl = "", sentBody : any;
        const fetchFn = vi.fn(async (url : string, init : RequestInit) => {
            sentUrl = url; sentBody = JSON.parse(String(init.body));
            return jsonResponse({ choices: [{ message: { content: JSON.stringify({ docs: [{ slug: "overview", title: "Overview", markdown: "# hi" }] }) } }] });
        });
        const model = new GatewayDocModel("https://gw.example/v1", "tok", "some-model", fetchFn);

        const docs = await model.writeDocs(context);

        expect(sentUrl).toBe("https://gw.example/v1/chat/completions");
        expect(sentBody.response_format.type).toBe("json_schema");
        expect(sentBody.messages[1].content).toContain("src/machine.ts");
        expect(docs).toEqual([{ slug: "overview", title: "Overview", markdown: "# hi" }]);
    });

    it("returns nothing and does not call the model when no token is configured", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const fetchFn = vi.fn();
        const model = new GatewayDocModel("https://gw.example/v1", "", "m", fetchFn as any);

        expect(await model.writeDocs(context)).toEqual([]);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it("throws on a non-ok response so the generator can log and move on", async () => {
        const model = new GatewayDocModel("https://gw.example/v1", "tok", "m",
            async () => jsonResponse({ error: { message: "rate limited" } }, false, 429));

        await expect(model.writeDocs(context)).rejects.toThrow("429");
    });

    it("tells the model when the source was truncated", async () => {
        let sentBody : any;
        const model = new GatewayDocModel("https://gw.example/v1", "tok", "m", async (_url, init) => {
            sentBody = JSON.parse(String(init.body));
            return jsonResponse({ choices: [{ message: { content: JSON.stringify({ docs: [] }) } }] });
        });

        await model.writeDocs({ ...context, truncated: true });

        expect(sentBody.messages[1].content).toContain("truncated");
    });

});
