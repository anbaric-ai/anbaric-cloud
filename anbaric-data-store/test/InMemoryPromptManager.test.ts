import {describe, expect, it} from "vitest";
import {InMemoryPromptManager} from "../src/InMemoryPromptManager.js";

const schema = { type: "object" as const, properties: { priority: { type: "string" as const, enum: ["low", "high"] } } };

describe("InMemoryPromptManager", () => {

    it("saves a first version for the app and returns it", async () => {
        const prompts = new InMemoryPromptManager("crm");

        const saved = await prompts.save("triage", "Decide the priority.", undefined, schema);

        expect(saved).toMatchObject({ appId: "crm", promptId: "triage", version: 1, instructions: "Decide the priority.", outputSchema: schema });
        expect(saved.inputSchema).toBeUndefined();
        expect(saved.createdAt).toMatch(/^\d{4}-/);
    });

    it("increments the version when the content changes", async () => {
        const prompts = new InMemoryPromptManager("crm");
        await prompts.save("triage", "Decide the priority.");

        const second = await prompts.save("triage", "Decide the priority, favouring high.");

        expect(second.version).toBe(2);
        expect((await prompts.retrieve("triage")).version).toBe(2);
    });

    it("does not store a new version when the content is identical", async () => {
        const prompts = new InMemoryPromptManager("crm");
        await prompts.save("triage", "Decide the priority.", { type: "object", required: ["subject"] }, schema);

        const again = await prompts.save("triage", "Decide the priority.", { required: ["subject"], type: "object" }, schema);

        expect(again.version).toBe(1);
        expect(await prompts.history("triage")).toHaveLength(1);
    });

    it("retrieves the latest by default, or a named version", async () => {
        const prompts = new InMemoryPromptManager("crm");
        await prompts.save("triage", "v1");
        await prompts.save("triage", "v2");

        expect((await prompts.retrieve("triage")).instructions).toBe("v2");
        expect((await prompts.retrieve("triage", 1)).instructions).toBe("v1");
    });

    it("throws for an unknown prompt or version", async () => {
        const prompts = new InMemoryPromptManager("crm");
        await prompts.save("triage", "v1");

        await expect(prompts.retrieve("nope")).rejects.toThrow('No prompt found with id "nope"');
        await expect(prompts.retrieve("triage", 9)).rejects.toThrow('No prompt found with id "triage" at version 9');
    });

    it("lists the latest of every prompt and a prompt's history newest first", async () => {
        const prompts = new InMemoryPromptManager("crm");
        await prompts.save("triage", "v1");
        await prompts.save("triage", "v2");
        await prompts.save("summarise", "s1");

        expect((await prompts.list()).map(prompt => [prompt.promptId, prompt.version])).toEqual([["summarise", 1], ["triage", 2]]);
        expect((await prompts.history("triage")).map(prompt => prompt.version)).toEqual([2, 1]);
    });

    it("hands out copies, so callers cannot mutate stored versions", async () => {
        const prompts = new InMemoryPromptManager("crm");
        const saved = await prompts.save("triage", "v1", undefined, { type: "object" });
        saved.outputSchema!.type = "array";

        expect((await prompts.retrieve("triage")).outputSchema).toEqual({ type: "object" });
    });

});
