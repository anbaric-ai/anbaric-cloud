import {createInterface} from "node:readline/promises";
import {dim} from "./Ansi";

const ask = async (question : string, defaultAnswer : string) : Promise<string> => {
    if (!process.stdin.isTTY) return defaultAnswer;

    const readline = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await readline.question(`${question} ${dim(`(${defaultAnswer})`)}: `)).trim();
    readline.close();
    return answer || defaultAnswer;
};

const confirm = async (question : string) : Promise<boolean> => {
    if (!process.stdin.isTTY) return false;

    const readline = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await readline.question(`${question} ${dim("(y/N)")}: `)).trim().toLowerCase();
    readline.close();
    return answer === "y" || answer === "yes";
};

export { ask, confirm }
