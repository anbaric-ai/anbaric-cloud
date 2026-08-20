import {afterEach, describe, expect, it} from "vitest";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {versionSkewWarning} from "../src/versionCheck";

const ownVersion = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")).version;
const ownMinor = /(\d+\.\d+)\./.exec(ownVersion)![1];

describe("versionSkewWarning", () => {

    const created : Array<string> = [];

    const project = (manifest : object) : string => {
        const dir = mkdtempSync(join(tmpdir(), "anbaric-cli-version-"));
        writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
        created.push(dir);
        return dir;
    };

    afterEach(() => {
        while (created.length) rmSync(created.pop()!, { recursive: true, force: true });
    });

    it("warns when the project's anbaric is a different minor from the CLI", () => {
        const warning = versionSkewWarning(project({ dependencies: { anbaric: "^0.1.0" } }));

        expect(warning).toContain(`anbaric-cli ${ownVersion}`);
        expect(warning).toContain("0.1.0");
    });

    it("is quiet when the minors match, even across a caret range", () => {
        expect(versionSkewWarning(project({ dependencies: { anbaric: `^${ownMinor}.0` } }))).toBeUndefined();
    });

    it("is quiet when the project declares no anbaric dependency", () => {
        expect(versionSkewWarning(project({ dependencies: { express: "^4.0.0" } }))).toBeUndefined();
    });

    it("is quiet for a non-semver range such as a file: link", () => {
        expect(versionSkewWarning(project({ dependencies: { anbaric: "file:../anbaric" } }))).toBeUndefined();
    });

    it("picks up any anbaric-* library, not only the umbrella package", () => {
        expect(versionSkewWarning(project({ dependencies: { "anbaric-state-machine": "^0.2.0" } }))).toContain("0.2.0");
    });

});
