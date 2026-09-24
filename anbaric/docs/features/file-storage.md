# File storage

Some data is a file: a generated report, an uploaded CSV, an image a job
produced. `FileStorage` keeps bytes at a path, with a content type, and is
obtained from a factory and used with an actor so every access is audited. Like
the other stores it's local on your machine and platform-backed once deployed —
no code change.

## Putting and getting files

```ts
import {FileStorageFactory} from "anbaric";

const files = FileStorageFactory.instance();

await files.put(actor, "reports/q3.csv", new TextEncoder().encode("a,b"), "text/csv");

const report = await files.get("reports/q3.csv", actor);
report.contents;        // Uint8Array
report.contentType;     // "text/csv"
report.size;            // 3
report.lastModified;    // Date

const inReports = await files.list("reports/", actor);   // paths, sizes, dates — no contents
await files.delete("reports/q3.csv", actor);
```

Paths are plain relative paths with `/` separators — `reports/q3.csv`, never
`/reports/q3.csv` or anything containing `..`. The content type defaults to
`application/octet-stream` when you don't give one. Getting an unknown path
throws `No file found at "..."`.

`list` takes a prefix and returns everything under it; pass `""` for every
file. It returns metadata only, so listing a large store never loads the bytes.

## Where files go

**Locally** files live on disk under a temporary directory — `/tmp/anbaric/files`
on macOS and Linux, the equivalent temp folder on Windows — so a restart keeps
them and a reboot may not. Point `ANBARIC_FILE_STORAGE_PATH` at a directory to
keep them somewhere permanent.

**Deployed** files live in your tenant's storage, owned by your app: a path is
private to the app that wrote it, so two apps can use the same path without
colliding. The **Storage** page in the console lists what each app has stored.

## Next

- [Documents and secrets](documents-and-secrets.md) — the JSON and secret stores
- [API: Stores](../api/stores.md)
