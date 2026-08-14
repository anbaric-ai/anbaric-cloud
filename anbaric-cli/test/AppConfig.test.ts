import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {AppConfig, isValidAppName} from "../src/AppConfig";

describe("AppConfig", () => {

    let appDir : string;

    beforeEach(async () => {
        appDir = await mkdtemp(join(tmpdir(), "anbaric-app-"));
    });

    afterEach(async () => {
        await rm(appDir, { recursive: true, force: true });
    });

    it("round-trips the app config in .anbaric/app-config.json", async () => {
        const path = await AppConfig.save(appDir, { name: "crm", internalPort: 3000 });

        expect(path).toBe(join(appDir, ".anbaric", "app-config.json"));
        expect(await AppConfig.load(appDir)).toEqual({ name: "crm", internalPort: 3000 });
    });

    it("loads undefined when no config exists", async () => {
        expect(await AppConfig.load(appDir)).toBeUndefined();
    });

    it("suggests a sanitized name from package.json", async () => {
        await writeFile(join(appDir, "package.json"), JSON.stringify({ name: "My CRM App!" }));

        expect(await AppConfig.suggestedName(appDir)).toBe("my-crm-app-");
    });

    it("suggests a fallback name without a package.json", async () => {
        expect(await AppConfig.suggestedName(appDir)).toBe("app");
    });

    describe("name validation", () => {

        it("accepts lowercase alphanumerics with dashes and underscores", () => {
            expect(isValidAppName("crm")).toBe(true);
            expect(isValidAppName("my-app_2")).toBe(true);
        });

        it("rejects uppercase, spaces, and other characters", () => {
            expect(isValidAppName("CRM")).toBe(false);
            expect(isValidAppName("my app")).toBe(false);
            expect(isValidAppName("app/1")).toBe(false);
            expect(isValidAppName("")).toBe(false);
        });

    });

});
