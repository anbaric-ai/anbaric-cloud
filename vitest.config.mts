import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {defineConfig} from "vitest/config";

// The published packages resolve to their built dist/, so without these aliases
// the tests would run against stale output - and a class imported both ways
// would have two identities. Tests always run against src.
const root = dirname(fileURLToPath(import.meta.url));
const sourceOf = (directory : string) => join(root, directory, "src", "index.ts");

export default defineConfig({
    resolve: {
        alias: [
            { find: /^anbaric-tsapi$/, replacement: sourceOf("tsapi") },
            { find: /^anbaric-state-machine$/, replacement: sourceOf("anbaric-state-machine") },
            { find: /^anbaric-data-store$/, replacement: sourceOf("anbaric-data-store") },
            { find: /^anbaric-impl-cloud$/, replacement: sourceOf("anbaric-impl-cloud") },
            { find: /^anbaric$/, replacement: sourceOf("anbaric") },
        ],
    },
});
