#!/usr/bin/env node
import {spawn} from "node:child_process";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const main = require.resolve("anbaric-cloud-hosting/src/main.ts");

const child = spawn(process.execPath, [tsxCli, main, ...process.argv.slice(2)], { stdio: "inherit" });
child.on("exit", code => process.exit(code ?? 1));
