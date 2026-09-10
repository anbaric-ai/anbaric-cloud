import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {gatherSources} from "../../src/docs/gatherSources";

describe("gatherSources", () => {

    let dir : string;
    const write = async (path : string, content : string) => {
        await mkdir(join(dir, path, ".."), { recursive: true });
        await writeFile(join(dir, path), content);
    };

    beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "anbaric-gather-")); });
    afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

    it("collects code, config and docs and reports nothing truncated", async () => {
        await write("package.json", "{}");
        await write("README.md", "# app");
        await write("src/machine.ts", "x");

        const { files, truncated } = await gatherSources(dir);

        expect(files.map(file => file.path).sort()).toEqual(["README.md", "package.json", "src/machine.ts"]);
        expect(truncated).toBe(false);
    });

    it("skips dependencies and build output", async () => {
        await write("src/main.ts", "x");
        await write("node_modules/dep/index.js", "junk");
        await write("dist/main.js", "built");

        const { files } = await gatherSources(dir);

        expect(files.map(file => file.path)).toEqual(["src/main.ts"]);
    });

    it("skips an oversized non-manifest file - a baked data blob", async () => {
        await write("src/main.ts", "x");
        await write("src/companies.json", "y".repeat(40_000));

        const { files } = await gatherSources(dir);

        expect(files.map(file => file.path)).toEqual(["src/main.ts"]);
    });

    it("keeps a large package.json, because a manifest is always worth reading", async () => {
        await write("package.json", `{"x":"${"y".repeat(40_000)}"}`);

        const { files } = await gatherSources(dir);

        expect(files.map(file => file.path)).toEqual(["package.json"]);
    });

    it("orders manifests and docs before source", async () => {
        await write("src/z.ts", "z");
        await write("readme.md", "r");
        await write("package.json", "{}");

        const { files } = await gatherSources(dir);

        expect(files.map(file => file.path)).toEqual(["package.json", "readme.md", "src/z.ts"]);
    });

    it("truncates past the total cap, keeping the highest-priority files", async () => {
        await write("package.json", "{}");
        // Many source files each just under the per-file cap; together over total.
        for (let i = 0; i < 12; i++) await write(`src/f${i}.ts`, "y".repeat(25_000));

        const { files, truncated } = await gatherSources(dir);

        expect(truncated).toBe(true);
        expect(files[0].path).toBe("package.json");
        expect(files.length).toBeLessThan(13);
    });

});
