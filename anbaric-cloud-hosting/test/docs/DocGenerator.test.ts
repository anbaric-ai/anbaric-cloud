import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {InMemoryAppDocsStore} from "../../src/data-store/InMemoryAppDocsStore";
import {DocContext, DocModel} from "../../src/docs/DocModel";
import {DocGenerator} from "../../src/docs/DocGenerator";

const draft = (slug : string, over : object = {}) => ({ slug, title: slug, markdown: `# ${slug}`, ...over });
const root = (slug : string, position : number) =>
    ({ slug, title: slug, markdown: `# ${slug}`, parentSlug: null, position });
const child = (slug : string, parentSlug : string, position : number) =>
    ({ slug, title: slug, markdown: `# ${slug}`, parentSlug, position });

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

    it("passes the gathered source to the model and stores a single doc as the root", async () => {
        let seen : DocContext | undefined;
        const generator = new DocGenerator(
            model(async (context) => { seen = context; return [draft("overview")]; }), store);

        await generator.generate("crm", appDir, { redeploy: false });

        expect(seen!.appName).toBe("crm");
        expect(seen!.files.map(file => file.path).sort()).toEqual(["package.json", "src/machine.ts"]);
        expect(await store.listForApp("crm")).toEqual([root("overview", 0)]);
    });

    it("arranges the docs as an introduction with the other pages beneath it", async () => {
        const generator = new DocGenerator(
            model(async () => [draft("introduction"), draft("workflows"), draft("billing")]), store);

        await generator.generate("crm", appDir, { redeploy: false });

        expect(await store.listForApp("crm")).toEqual([
            root("introduction", 0),
            child("workflows", "introduction", 0),
            child("billing", "introduction", 1),
        ]);
    });

    it("keeps a page's own parent when it validly nests below another page", async () => {
        const generator = new DocGenerator(
            model(async () => [draft("introduction"), draft("setup"), draft("advanced", { parentSlug: "setup" })]), store);

        await generator.generate("crm", appDir, { redeploy: false });

        expect(await store.listForApp("crm")).toEqual([
            root("introduction", 0),
            child("setup", "introduction", 0),
            child("advanced", "setup", 0),
        ]);
    });

    it("promotes the first page to the introduction root when the model names none", async () => {
        const generator = new DocGenerator(
            model(async () => [draft("getting-started"), draft("faq")]), store);

        await generator.generate("crm", appDir, { redeploy: false });

        expect(await store.listForApp("crm")).toEqual([
            root("getting-started", 0),
            child("faq", "getting-started", 0),
        ]);
    });

    it("copies the README in verbatim as a second root beside the introduction", async () => {
        const readme = "# CRM\n\nRun it *carefully*.\n";
        await writeFile(join(appDir, "README.md"), readme);
        const generator = new DocGenerator(model(async () => [draft("introduction")]), store);

        await generator.generate("crm", appDir, { redeploy: false });

        expect(await store.listForApp("crm")).toEqual([
            root("introduction", 0),
            { slug: "readme", title: "README", markdown: readme, parentSlug: null, position: 1 },
        ]);
    });

    it("replaces the whole set on a redeploy", async () => {
        await store.replaceForApp("crm", [root("old-a", 0), root("old-b", 1)]);
        const generator = new DocGenerator(model(async () => [draft("fresh")]), store);

        await generator.generate("crm", appDir, { redeploy: true });

        expect(await store.listForApp("crm")).toEqual([root("fresh", 0)]);
    });

    it("leaves existing docs alone when the model throws", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        await store.replaceForApp("crm", [root("kept", 0)]);
        const generator = new DocGenerator(model(async () => { throw new Error("model down"); }), store);

        await expect(generator.generate("crm", appDir, { redeploy: true })).resolves.toBe(0);

        expect(await store.listForApp("crm")).toEqual([root("kept", 0)]);
    });

    it("does not touch the store when the model returns nothing", async () => {
        const replace = vi.spyOn(store, "replaceForApp");
        const generator = new DocGenerator(model(async () => []), store);

        await generator.generate("crm", appDir, { redeploy: false });

        expect(replace).not.toHaveBeenCalled();
    });

    it("never throws even if the source directory is unreadable", async () => {
        const generator = new DocGenerator(model(async () => [draft("x")]), store);

        await expect(generator.generate("crm", join(appDir, "missing"), { redeploy: false })).resolves.toBe(0);
    });

});
