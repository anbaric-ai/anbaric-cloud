import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Actor, Auditor} from "anbaric-tsapi";
import {LocalFileSystemStorage} from "../src/LocalFileSystemStorage";

const actor : Actor = { type: "CODE", id: "tester", roles: ["code"] };

const bytes = (text : string) => new TextEncoder().encode(text);
const text = (contents : Uint8Array) => new TextDecoder().decode(contents);

describe("LocalFileSystemStorage", () => {

    let root : string;
    let storage : LocalFileSystemStorage;

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), "anbaric-files-"));
        storage = new LocalFileSystemStorage(root);
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it("stores a file and gives it back with its type and size", async () => {
        await storage.put(actor, "reports/q3.csv", bytes("a,b,c"), "text/csv");

        const file = await storage.get("reports/q3.csv", actor);

        expect(text(file.contents)).toBe("a,b,c");
        expect(file.contentType).toBe("text/csv");
        expect(file.size).toBe(5);
        expect(file.lastModified).toBeInstanceOf(Date);
    });

    it("falls back to a binary type when none was given", async () => {
        await storage.put(actor, "blob", bytes("x"));

        expect((await storage.get("blob", actor)).contentType).toBe("application/octet-stream");
    });

    it("overwrites a file put again under the same path", async () => {
        await storage.put(actor, "note.txt", bytes("first"), "text/plain");
        await storage.put(actor, "note.txt", bytes("second"), "text/plain");

        expect(text((await storage.get("note.txt", actor)).contents)).toBe("second");
    });

    it("throws a clear error for a file that is not there", async () => {
        await expect(storage.get("missing.txt", actor)).rejects.toThrow('No file found at "missing.txt"');
    });

    it("deletes a file, and deleting it again is not an error", async () => {
        await storage.put(actor, "gone.txt", bytes("x"), "text/plain");

        await storage.delete("gone.txt", actor);
        await storage.delete("gone.txt", actor);

        await expect(storage.get("gone.txt", actor)).rejects.toThrow();
    });

    it("lists files under a prefix, sorted, without its own bookkeeping", async () => {
        await storage.put(actor, "reports/b.csv", bytes("2"), "text/csv");
        await storage.put(actor, "reports/a.csv", bytes("1"), "text/csv");
        await storage.put(actor, "other/c.txt", bytes("3"), "text/plain");

        const listed = await storage.list("reports/", actor);

        expect(listed.map(file => file.path)).toEqual(["reports/a.csv", "reports/b.csv"]);
        expect(listed[0]).toMatchObject({ contentType: "text/csv", size: 1 });
        expect((await storage.list("", actor)).map(file => file.path)).toEqual(["other/c.txt", "reports/a.csv", "reports/b.csv"]);
    });

    it("refuses any path that would leave the root", async () => {
        for (const escape of ["../outside.txt", "reports/../../outside.txt", "/etc/passwd"]) {
            await expect(storage.put(actor, escape, bytes("x"))).rejects.toThrow("outside the file storage root");
        }
    });

    it("refuses an empty path or a directory", async () => {
        await expect(storage.put(actor, "", bytes("x"))).rejects.toThrow("is not a file path");
        await expect(storage.put(actor, "reports/", bytes("x"))).rejects.toThrow("is not a file path");
    });

    it("audits each interaction with the size and type, never the contents", async () => {
        const audit = vi.fn(async () => {});
        const audited = new LocalFileSystemStorage(root, { audit } as unknown as Auditor);

        await audited.put(actor, "secret.txt", bytes("do not log me"), "text/plain");
        await audited.get("secret.txt", actor);

        expect(audit).toHaveBeenCalledTimes(2);
        const putCall = audit.mock.calls[0] as unknown as Array<unknown>;
        expect(putCall).toContain("file");
        expect(putCall).toContain("secret.txt");
        expect(JSON.stringify(putCall)).not.toContain("do not log me");
        expect(JSON.stringify(putCall)).toContain('"size":13');
    });

});
