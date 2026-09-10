import {readFile, readdir} from "node:fs/promises";
import {join, relative} from "node:path";

const INCLUDE = /\.(ts|tsx|js|jsx|json|md|css|html)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".next", "build", "coverage"]);
const SKIP_FILES = new Set(["package-lock.json"]);

// A file this big that isn't a manifest is almost always baked data or an
// inlined asset - noise that would crowd out code and burn tokens.
const MAX_FILE_BYTES = 30_000;
// ~60K tokens of source, a generous ceiling; real apps are far under it.
const MAX_TOTAL_BYTES = 240_000;

type GatheredFile = { path : string, content : string };
type Gathered = { files : Array<GatheredFile>, truncated : boolean };

const isManifest = (path : string) : boolean =>
    /(^|\/)package\.json$/.test(path) || /(^|\/)\.anbaric\/app-config\.json$/.test(path) || /(^|\/)readme\.md$/i.test(path);

// Manifests and docs first, then source, then the rest - so a truncated
// snapshot keeps the files that describe the app best.
const priority = (path : string) : number => {
    if (isManifest(path)) return 0;
    if (path.toLowerCase().endsWith(".md")) return 1;
    if (/\.(ts|tsx|js|jsx)$/.test(path)) return 2;
    return 3;
};

const walk = async (dir : string, root : string, found : Array<string>) : Promise<void> => {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) await walk(full, root, found);
        } else if (INCLUDE.test(entry.name) && !SKIP_FILES.has(entry.name)) {
            found.push(relative(root, full));
        }
    }
};

/* The whole of an app's source, small enough to hand to a model in one go:
   manifests, docs and code, skipping dependencies, build output and oversized
   data files, and capped in total. `truncated` is true when the cap dropped
   files, so the caller can tell the model not to assume it saw everything. */
const gatherSources = async (appDir : string) : Promise<Gathered> => {
    const paths : Array<string> = [];
    await walk(appDir, appDir, paths);
    paths.sort((left, right) => priority(left) - priority(right) || left.localeCompare(right));

    const files : Array<GatheredFile> = [];
    let total = 0;
    let truncated = false;

    for (const path of paths) {
        let content : string;
        try {
            content = await readFile(join(appDir, path), "utf8");
        } catch {
            continue;
        }

        if (!isManifest(path) && content.length > MAX_FILE_BYTES) continue;
        if (total + content.length > MAX_TOTAL_BYTES) { truncated = true; continue; }

        files.push({ path, content });
        total += content.length;
    }

    return { files, truncated };
};

export { gatherSources };
export type { Gathered, GatheredFile };
