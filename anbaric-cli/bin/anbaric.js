#!/usr/bin/env node
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const tsx = fileURLToPath(new URL("../../node_modules/.bin/tsx", import.meta.url));
const main = fileURLToPath(new URL("../src/main.ts", import.meta.url));

const child = spawn(tsx, [main, ...process.argv.slice(2)], { stdio: "inherit" });
child.on("exit", code => process.exit(code ?? 1));
