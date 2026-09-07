import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {resolveAppName} from "../src/resolveAppName";

describe("resolveAppName", () => {

    let root : string;
    let cwd : string;

    const packageNamed = (name : string) => writeFile(join(root, "package.json"), JSON.stringify({ name }));

    const configuredAs = async (name : string) => {
        await mkdir(join(root, ".anbaric"), { recursive: true });
        await writeFile(join(root, ".anbaric", "app-config.json"), JSON.stringify({ name, internalPort: 3000 }));
    };

    beforeEach(async () => {
        cwd = process.cwd();
        root = await mkdtemp(join(tmpdir(), "anbaric-appname-"));
        process.chdir(root);
    });

    afterEach(async () => {
        process.chdir(cwd);
        await rm(root, { recursive: true, force: true });
    });

    it("uses the name it was given, whatever the directory says", async () => {
        await packageNamed("local-thing");

        expect(await resolveAppName("other-app")).toBe("other-app");
    });

    it("falls back to the name the app was configured with", async () => {
        await packageNamed("local-thing");
        await configuredAs("crm");

        expect(await resolveAppName()).toBe("crm");
    });

    // configure may have chosen a different name from the package's.
    it("prefers the configured name over package.json", async () => {
        await packageNamed("link-media");
        await configuredAs("link-media-brief");

        expect(await resolveAppName()).toBe("link-media-brief");
    });

    it("uses package.json when the app has not been configured", async () => {
        await packageNamed("crm");

        expect(await resolveAppName()).toBe("crm");
    });

    it("finds the app from a nested directory", async () => {
        await packageNamed("crm");
        const nested = join(root, "src", "machines");
        await mkdir(nested, { recursive: true });
        process.chdir(nested);

        expect(await resolveAppName()).toBe("crm");
    });

    it("sanitises a scoped package name", async () => {
        await packageNamed("@acme/Customer_Relations");

        expect(await resolveAppName()).toBe("-acme-customer_relations");
    });

    it("explains itself when the package has no usable name", async () => {
        await writeFile(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));

        await expect(resolveAppName()).rejects.toThrowError(/no usable "name"/);
    });

    it("says where to run it when there is no project at all", async () => {
        await expect(resolveAppName()).rejects.toThrowError(/No package.json found/);
    });

});
