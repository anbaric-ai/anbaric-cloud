import {describe, expect, it} from "vitest";
import {InMemorySkillStore} from "../../src/data-store/InMemorySkillStore";
import {isSkillId} from "../../src/data-store/SkillStore";

const draft = { id: "web-fetching", title: "Fetching web pages", usageHints: "Read before fetching a page", body: "POST /html" };

describe("InMemorySkillStore", () => {

    it("saves a skill, stamps it, and lists it by id", async () => {
        const store = new InMemorySkillStore();

        const saved = await store.save(draft);
        await store.save({ ...draft, id: "agentic-actions", title: "Agentic actions" });

        expect(saved).toMatchObject(draft);
        expect(saved.createdAt).toBeInstanceOf(Date);
        expect((await store.list()).map(skill => skill.id)).toEqual(["agentic-actions", "web-fetching"]);
        expect((await store.get("web-fetching"))?.title).toBe("Fetching web pages");
    });

    it("replaces a skill saved again under the same id, keeping when it was first made", async () => {
        const store = new InMemorySkillStore();
        const first = await store.save(draft);

        const second = await store.save({ ...draft, body: "POST /html with stealth" });

        expect(second.body).toBe("POST /html with stealth");
        expect(second.createdAt).toEqual(first.createdAt);
        expect(await store.list()).toHaveLength(1);
    });

    it("removes a skill and says whether there was one", async () => {
        const store = new InMemorySkillStore();
        await store.save(draft);

        expect(await store.remove("web-fetching")).toBe(true);
        expect(await store.remove("web-fetching")).toBe(false);
        expect(await store.get("web-fetching")).toBeUndefined();
    });

});

describe("a skill id", () => {

    // It ends up inside a tool name, so it has a tool name's shape and a budget.
    it("is lower-case letters, digits and hyphens, up to fifty characters", () => {
        expect(isSkillId("web-fetching")).toBe(true);
        expect(isSkillId("a")).toBe(true);
        expect(isSkillId("x".repeat(50))).toBe(true);
        expect(isSkillId("x".repeat(51))).toBe(false);
        expect(isSkillId("Web Fetching")).toBe(false);
        expect(isSkillId("-leading")).toBe(false);
        expect(isSkillId("")).toBe(false);
        expect(isSkillId(42)).toBe(false);
    });

});
