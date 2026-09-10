import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {InMemoryAppDocsStore} from "../../src/data-store/InMemoryAppDocsStore";
import {DocContext, DocModel} from "../../src/docs/DocModel";
import {DocGenerator} from "../../src/docs/DocGenerator";

const doc = (slug : string) => ({ slug, title: slug, markdown: `# ${slug}` });

describe("DocGenerator", () => {

    let appDir : string;
    let store : InMemoryAppDocsStore;

    beforeEach(async () => {
        appDir = await mkdtemp(join(tmpdir(), "anbaric-docgen-"));
        await writeFile(join(appDir, "package.json"), JSON.stringify({ name: "crm" }));
        await mkdir(join(appDir, "src"), { recursive: true });
        await writeFile(join(appDir, "src", "machine.ts"), "export const machine = 1;");
        store = new InMemoryAppDocsStore();
    });

    afterEach(async () => {
        await rm(appDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    const model = (writeDocs : DocModel["writeDocs"]) : DocModel => ({ writeDocs: vi.fn(writeDocs) });

    it("passes the gathered source to the model and stores what it returns", async () => {
        let seen : DocContext | undefined;
        const generator = new DocGenerator(
            model(async (context) => { seen = context; return [doc("overview")]; }), store);

        await generator.generate("crm", appDir, { redeploy: false });

        expect(seen!.appName).toBe("crm");
        expect(seen!.files.map(file => file.path).sort()).toEqual(["package.json", "src/machine.ts"]);
        expect(await store.listForApp("crm")).toEqual([doc("overview")]);
    });

    it("replaces the whole set on a redeploy", async () => {
        await store.replaceForApp("crm", [doc("old-a"), doc("old-b")]);
        const generator = new DocGenerator(model(async () => [doc("fresh")]), store);

        await generator.generate("crm", appDir, { redeploy: true });

        expect(await store.listForApp("crm")).toEqual([doc("fresh")]);
    });

    it("leaves existing docs alone when the model throws", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await store.replaceForApp("crm", [doc("kept")]);
        const generator = new DocGenerator(model(async () => { throw new Error("model down"); }), store);

        await expect(generator.generate("crm", appDir, { redeploy: true })).resolves.toBeUndefined();

        expect(await store.listForApp("crm")).toEqual([doc("kept")]);
    });

    it("does not touch the store when the model returns nothing", async () => {
        const replace = vi.spyOn(store, "replaceForApp");
        const generator = new DocGenerator(model(async () => []), store);

        await generator.generate("crm", appDir, { redeploy: false });

        expect(replace).not.toHaveBeenCalled();
    });

    it("never throws even if the source directory is unreadable", async () => {
        const generator = new DocGenerator(model(async () => [doc("x")]), store);

        await expect(generator.generate("crm", join(appDir, "missing"), { redeploy: false })).resolves.toBeUndefined();
    });

});
