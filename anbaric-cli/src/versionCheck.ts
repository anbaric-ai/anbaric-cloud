import {existsSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const readManifest = (path : string) : any => JSON.parse(readFileSync(path, "utf8"));

const ownVersion = () : string | undefined => {
    try {
        return readManifest(fileURLToPath(new URL("../package.json", import.meta.url))).version;
    } catch {
        return undefined;
    }
};

const nearestManifest = (start : string) : any | undefined => {
    let dir = resolve(start);
    while (true) {
        const candidate = join(dir, "package.json");
        if (existsSync(candidate)) {
            try {
                return readManifest(candidate);
            } catch {
                return undefined;
            }
        }
        const parent = dirname(dir);
        if (parent === dir) return undefined;
        dir = parent;
    }
};

const declaredAnbaricVersion = (manifest : any) : string | undefined => {
    const dependencies = { ...(manifest.devDependencies ?? {}), ...(manifest.dependencies ?? {}) };
    for (const [name, range] of Object.entries(dependencies)) {
        if (name !== "anbaric" && ! name.startsWith("anbaric-")) continue;
        if (name === "anbaric-cli") continue;
        const version = /(\d+\.\d+\.\d+)/.exec(String(range))?.[1];
        if (version) return version;
    }
    return undefined;
};

const minorOf = (version : string) : string | undefined => /(\d+\.\d+)\./.exec(version)?.[1];

/* Warns when the globally-installed CLI is a different release line from the
   anbaric library the current project depends on - a skew that silently
   changes behaviour and confuses debugging. Resilient: any missing or
   unreadable manifest, or a non-semver range (file:, workspace:), means no
   warning. Compared on major.minor so patch drift within a range is quiet. */
const versionSkewWarning = (start : string = process.cwd()) : string | undefined => {
    const own = ownVersion();
    if (! own) return undefined;

    const manifest = nearestManifest(start);
    if (! manifest) return undefined;

    const library = declaredAnbaricVersion(manifest);
    if (! library) return undefined;

    const ownMinor = minorOf(own);
    if (! ownMinor || ownMinor === minorOf(library)) return undefined;

    return `anbaric-cli ${own} does not match the anbaric ${library} this project uses — they can behave differently. `
        + `Align them with "npm i -g anbaric-cli@${minorOf(library)}" or update the project's anbaric dependency.`;
};

export { versionSkewWarning };
