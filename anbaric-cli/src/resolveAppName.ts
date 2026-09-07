import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {AppConfig, isValidAppName} from "./AppConfig";
import {findAppRoot} from "./findAppRoot";

/* Which app a command is about. Naming it explicitly always wins; otherwise it
   is the app you are standing in, found by walking up to the nearest
   package.json the same way deploy does.

   .anbaric/app-config.json is preferred over package.json because that is the
   name the app was actually deployed under - `anbaric app configure` may have
   chosen a different one. */
const resolveAppName = async (explicit? : string) : Promise<string> => {
    if (explicit) return explicit;

    const appRoot = findAppRoot();

    const configured = await AppConfig.load(appRoot);
    if (configured) return configured.name;

    const named = await nameFromPackage(appRoot);
    if (named) return named;

    throw new Error(`No app name given, and ${join(appRoot, "package.json")} has no usable "name" - pass the app name or run \`anbaric app configure\``);
};

const nameFromPackage = async (appRoot : string) : Promise<string | undefined> => {
    let manifest : any;
    try {
        manifest = JSON.parse(await readFile(join(appRoot, "package.json"), "utf8"));
    } catch {
        return undefined;
    }

    if (typeof manifest?.name !== "string") return undefined;

    const sanitized = manifest.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    return isValidAppName(sanitized) ? sanitized : undefined;
};

export { resolveAppName };
