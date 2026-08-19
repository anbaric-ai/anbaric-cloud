import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {findAppRoot} from "../src/findAppRoot";

describe("findAppRoot", () => {

    let root : string;

    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "anbaric-approot-")); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    it("returns the directory that holds package.json when run there", async () => {
        await writeFile(join(root, "package.json"), "{}");

        expect(findAppRoot(root)).toBe(root);
    });

    it("walks up from a nested directory to the app root", async () => {
        await writeFile(join(root, "package.json"), "{}");
        const nested = join(root, "src", "state-machines");
        await mkdir(nested, { recursive: true });

        expect(findAppRoot(nested)).toBe(root);
    });

    it("throws when no package.json exists at or above the directory", async () => {
        expect(() => findAppRoot(root)).toThrowError(/No package.json found/);
    });

});
