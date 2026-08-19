import {existsSync} from "node:fs";
import {dirname, join, resolve} from "node:path";

/* The app root is the nearest directory at or above the working directory that
   holds a package.json, so app commands work from anywhere inside a project
   rather than only its top directory. */
const findAppRoot = (start : string = process.cwd()) : string => {
    let dir = resolve(start);
    while (true) {
        if (existsSync(join(dir, "package.json"))) return dir;
        const parent = dirname(dir);
        if (parent === dir) {
            throw new Error("No package.json found here or in any parent directory — run this inside an Anbaric app");
        }
        dir = parent;
    }
};

export { findAppRoot };
