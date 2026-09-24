import {describe, expect, it, vi} from "vitest";
import {
    DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, NoSuchKey, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";
import {Actor} from "anbaric-tsapi";
import {S3FileStorage} from "../../src/data-store/S3FileStorage";

const actor : Actor = { type: "CODE", id: "tester", roles: ["code"] };

const bytes = (text : string) => new TextEncoder().encode(text);

const stubbed = (answer : (command : any) => any = async () => ({})) => {
    const send = vi.fn(answer);
    return { send, storage: new S3FileStorage({ send } as unknown as S3Client, "tenant-files", "crm/") };
};

describe("S3FileStorage", () => {

    it("puts a file under the app's prefix with its content type", async () => {
        const { send, storage } = stubbed();

        await storage.put(actor, "reports/q3.csv", bytes("a,b"), "text/csv");

        const command = send.mock.calls[0][0];
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect(command.input).toMatchObject({ Bucket: "tenant-files", Key: "crm/reports/q3.csv", ContentType: "text/csv" });
    });

    it("gets a file back with what S3 knows about it", async () => {
        const { storage } = stubbed(async () => ({
            Body: { transformToByteArray: async () => bytes("a,b") },
            ContentType: "text/csv",
            ContentLength: 3,
            LastModified: new Date("2026-09-24T10:00:00Z"),
        }));

        const file = await storage.get("reports/q3.csv", actor);

        expect(new TextDecoder().decode(file.contents)).toBe("a,b");
        expect(file).toMatchObject({ path: "reports/q3.csv", contentType: "text/csv", size: 3 });
        expect(file.lastModified.toISOString()).toBe("2026-09-24T10:00:00.000Z");
    });

    it("turns a missing key into the same error every implementation gives", async () => {
        const { storage } = stubbed(async () => { throw new NoSuchKey({ message: "gone", $metadata: {} }); });

        await expect(storage.get("missing.txt", actor)).rejects.toThrow('No file found at "missing.txt"');
    });

    it("deletes by the prefixed key", async () => {
        const { send, storage } = stubbed();

        await storage.delete("reports/q3.csv", actor);

        expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
        expect(send.mock.calls[0][0].input).toMatchObject({ Key: "crm/reports/q3.csv" });
    });

    it("lists under the prefix, strips it, follows continuation and sorts", async () => {
        const { send, storage } = stubbed(async (command : any) => {
            if (command.input.ContinuationToken === "more") {
                return { Contents: [{ Key: "crm/reports/a.csv", Size: 1 }], IsTruncated: false };
            }
            return { Contents: [{ Key: "crm/reports/b.csv", Size: 2 }], IsTruncated: true, NextContinuationToken: "more" };
        });

        const listed = await storage.list("reports/", actor);

        expect(send.mock.calls[0][0]).toBeInstanceOf(ListObjectsV2Command);
        expect(send.mock.calls[0][0].input).toMatchObject({ Prefix: "crm/reports/" });
        expect(listed.map(file => file.path)).toEqual(["reports/a.csv", "reports/b.csv"]);
    });

    it("refuses a path that could reach outside the app's prefix", async () => {
        const { storage } = stubbed();

        await expect(storage.put(actor, "../other-app/x", bytes("x"))).rejects.toThrow("is not a file path");
        await expect(storage.put(actor, "/absolute", bytes("x"))).rejects.toThrow("is not a file path");
    });

});
