import {readFileSync, writeFileSync} from "node:fs";
import {join} from "node:path";

const root = JSON.parse(readFileSync("package.json", "utf8"));
const version : string = root.version;
if (!version) throw new Error("The root package.json needs a version - it is the single source for every workspace");

const alignDependencies = (dependencies? : Record<string, string>) => {
    for (const name of Object.keys(dependencies ?? {})) {
        if (name === "anbaric" || name.startsWith("anbaric-")) dependencies![name] = `^${version}`;
    }
};

for (const workspace of root.workspaces as Array<string>) {
    const manifestPath = join(workspace, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    manifest.version = version;
    alignDependencies(manifest.dependencies);
    alignDependencies(manifest.devDependencies);

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`${manifest.name} -> ${version}`);
}
