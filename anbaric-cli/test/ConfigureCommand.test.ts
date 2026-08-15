import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ConfigureCommand} from "../src/commands/ConfigureCommand";

describe("ConfigureCommand", () => {

    let appDir : string;

    beforeEach(async () => {
        appDir = await mkdtemp(join(tmpdir(), "anbaric-configure-"));
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await rm(appDir, { recursive: true, force: true });
    });

    const savedConfig = async () =>
        JSON.parse(await readFile(join(appDir, ".anbaric", "app-config.json"), "utf8"));

    it("writes the config from presets without prompting", async () => {
        const config = await new ConfigureCommand({ name: "crm", port: 4100 }).configure(appDir);

        expect(config).toEqual({ name: "crm", internalPort: 4100 });
        expect(await savedConfig()).toEqual({ name: "crm", internalPort: 4100 });
    });

    it("rejects an invalid preset name", async () => {
        await expect(new ConfigureCommand({ name: "Not Valid!", port: 4100 }).configure(appDir))
            .rejects.toThrowError('Invalid app name "Not Valid!"');
    });

    it("rejects an invalid preset port", async () => {
        await expect(new ConfigureCommand({ name: "crm", port: 99999 }).configure(appDir))
            .rejects.toThrowError('Invalid internal port "99999"');
    });

});
