import {
    DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, NoSuchKey, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";
import {Auditor, FileStorage, NoOpAuditor, StoredFile, StoredFileInfo} from "anbaric-tsapi";

/* Files in one S3 bucket, under a key prefix. The prefix is the app's, applied
   here and never by the app, which is what keeps one app's files from being
   another's: an app names paths, the platform decides where they land. */
class S3FileStorage extends FileStorage {

    constructor(private client : S3Client, private bucket : string, private prefix : string = "",
                auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
    }

    protected async putInternal(path : string, contents : Uint8Array, contentType : string) : Promise<void> {
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket, Key: this.keyFor(path), Body: contents, ContentType: contentType,
        }));
    }

    protected async getInternal(path : string) : Promise<StoredFile> {
        try {
            const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.keyFor(path) }));
            const contents = object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
            return {
                path,
                contents,
                contentType: object.ContentType ?? "application/octet-stream",
                size: object.ContentLength ?? contents.byteLength,
                lastModified: object.LastModified ?? new Date(),
            };
        } catch (error) {
            if (error instanceof NoSuchKey) throw new Error(`No file found at "${path}"`);
            throw error;
        }
    }

    protected async deleteInternal(path : string) : Promise<void> {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.keyFor(path) }));
    }

    protected async listInternal(prefix : string) : Promise<Array<StoredFileInfo>> {
        const found : Array<StoredFileInfo> = [];
        let token : string | undefined;

        do {
            const page = await this.client.send(new ListObjectsV2Command({
                Bucket: this.bucket, Prefix: this.keyFor(prefix), ContinuationToken: token,
            }));
            for (const object of page.Contents ?? []) {
                if (! object.Key) continue;
                found.push({
                    path: object.Key.slice(this.prefix.length),
                    contentType: "application/octet-stream",
                    size: object.Size ?? 0,
                    lastModified: object.LastModified ?? new Date(),
                });
            }
            token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);

        return found.sort((left, right) => left.path.localeCompare(right.path));
    }

    /* Paths are checked before they become keys: "..", a leading slash or an
       empty segment would let a path name something outside the prefix, or
       a key S3 treats differently from what the app meant. */
    private keyFor(path : string) : string {
        if (path.startsWith("/") || path.split("/").some(segment => segment === "..")) {
            throw new Error(`"${path}" is not a file path`);
        }
        return `${this.prefix}${path}`;
    }

}

export { S3FileStorage }
