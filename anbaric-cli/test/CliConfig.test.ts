import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {CliConfig, DEFAULT_PLATFORM_URL} from "../src/CliConfig";

describe("CliConfig", () => {

    let configDir : string;

    beforeEach(async () => {
        configDir = await mkdtemp(join(tmpdir(), "anbaric-cli-"));
        process.env.ANBARIC_CONFIG_DIR = configDir;
    });

    afterEach(async () => {
        delete process.env.ANBARIC_CONFIG_DIR;
        await rm(configDir, { recursive: true, force: true });
    });

    it("round-trips saved options", async () => {
        await CliConfig.save({ platformUrl: "http://platform:8787", tenant: "acme" });

        expect(await CliConfig.load()).toEqual({ platformUrl: "http://platform:8787", tenant: "acme" });
    });

    it("loads empty options when nothing is saved", async () => {
        expect(await CliConfig.load()).toEqual({});
    });

    it("resolves to defaults when nothing is saved or passed", async () => {
        expect(await CliConfig.resolve({})).toEqual({ platformUrl: DEFAULT_PLATFORM_URL, tenant: undefined });
    });

    it("prefers saved options over defaults", async () => {
        await CliConfig.save({ platformUrl: "http://platform:8787", tenant: "acme" });

        expect(await CliConfig.resolve({})).toEqual({ platformUrl: "http://platform:8787", tenant: "acme" });
    });

    it("prefers flags over saved options", async () => {
        await CliConfig.save({ platformUrl: "http://platform:8787", tenant: "acme" });

        expect(await CliConfig.resolve({ platformUrl: "http://other:1234", tenant: "globex" }))
            .toEqual({ platformUrl: "http://other:1234", tenant: "globex" });
    });

});
