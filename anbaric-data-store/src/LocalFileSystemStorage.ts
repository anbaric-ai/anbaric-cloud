import {mkdir, readdir, readFile, rm, stat, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, join, posix, relative, resolve, sep} from "node:path";
import {Auditor, FileStorage, NoOpAuditor, StoredFile, StoredFileInfo} from "anbaric-tsapi";

// The operating system's temporary directory - /tmp, or its equivalent
// elsewhere - so a local run leaves nothing behind in the project.
const defaultRoot = () => join(tmpdir(), "anbaric", "files");

/* The content type is not something a file system records, so it is kept in a
   sidecar next to the file rather than lost between put and get. */
const META_SUFFIX = ".anbaric-meta.json";

/* Files on the local disk under one root, for development and self-hosting.
   Every path is resolved against that root and refused if it would land
   outside it: the whole point of a root is that nothing an app names can
   reach past it. */
class LocalFileSystemStorage extends FileStorage {

    private root : string;

    constructor(root : string = process.env.ANBARIC_FILE_STORAGE_PATH ?? defaultRoot(), auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
        this.root = resolve(root);
    }

    protected async putInternal(path : string, contents : Uint8Array, contentType : string) : Promise<void> {
        const location = this.locate(path);
        await mkdir(dirname(location), { recursive: true });
        await writeFile(location, contents);
        await writeFile(`${location}${META_SUFFIX}`, JSON.stringify({ contentType }));
    }

    protected async getInternal(path : string) : Promise<StoredFile> {
        const location = this.locate(path);
        const info = await stat(location).catch(() => undefined);
        if (! info || ! info.isFile()) throw new Error(`No file found at "${path}"`);

        return {
            path,
            contents: await readFile(location),
            contentType: await this.contentTypeOf(location),
            size: info.size,
            lastModified: info.mtime,
        };
    }

    protected async deleteInternal(path : string) : Promise<void> {
        const location = this.locate(path);
        await rm(location, { force: true });
        await rm(`${location}${META_SUFFIX}`, { force: true });
    }

    protected async listInternal(prefix : string) : Promise<Array<StoredFileInfo>> {
        const found : Array<StoredFileInfo> = [];
        const entries = await readdir(this.root, { recursive: true, withFileTypes: true }).catch(() => []);

        for (const entry of entries) {
            if (! entry.isFile() || entry.name.endsWith(META_SUFFIX)) continue;

            const location = join(entry.parentPath, entry.name);
            const path = relative(this.root, location).split(sep).join(posix.sep);
            if (! path.startsWith(prefix)) continue;

            const info = await stat(location);
            found.push({ path, contentType: await this.contentTypeOf(location), size: info.size, lastModified: info.mtime });
        }

        return found.sort((left, right) => left.path.localeCompare(right.path));
    }

    /* Where a path lives on disk, or an error if it does not live under the
       root. Checked on the resolved absolute path, so "..", absolute paths and
       any other way of climbing out are all caught by the same comparison. */
    private locate(path : string) : string {
        if (! path || path.endsWith("/")) throw new Error(`"${path}" is not a file path`);

        const location = resolve(this.root, path);
        if (location !== this.root && ! location.startsWith(this.root + sep)) {
            throw new Error(`"${path}" is outside the file storage root`);
        }
        return location;
    }

    private async contentTypeOf(location : string) : Promise<string> {
        try {
            const meta = JSON.parse(await readFile(`${location}${META_SUFFIX}`, "utf8")) as { contentType? : unknown };
            return typeof meta.contentType === "string" ? meta.contentType : "application/octet-stream";
        } catch {
            return "application/octet-stream";
        }
    }

}

export { LocalFileSystemStorage };
