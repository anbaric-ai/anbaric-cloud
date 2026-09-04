import {cp, readdir, rm} from "node:fs/promises";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

// Single source of truth: the platform's own docs. This copies anbaric/docs
// into the skill's reference/ so the installed plugin ships versioned docs that
// the skill reads on demand. Run it on every release, after `npm run versions`.

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "..", "anbaric", "docs");
const destination = join(here, "..", "skills", "anbaric", "reference");

const sync = async () => {
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true });
    const files = await readdir(destination, { recursive: true });
    const markdown = files.filter(name => typeof name === "string" && name.endsWith(".md"));
    console.log(`Synced ${markdown.length} docs from ${source} to ${destination}`);
};

sync().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
