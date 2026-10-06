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

/* A value that must not be seen or kept: typed without echo at a terminal, or
   taken whole from a pipe (`echo "$KEY" | anbaric secrets set ...`) so a script
   never has to put it on a command line, where shell history would hold it. */
const askHidden = async (question : string) : Promise<string> => {
    if (!process.stdin.isTTY) {
        let piped = "";
        for await (const chunk of process.stdin) piped += chunk;
        return piped.replace(/\r?\n$/, "");
    }

    return new Promise(resolve => {
        const input = process.stdin;
        let value = "";

        const finish = () => {
            input.off("data", onData);
            input.setRawMode(false);
            input.pause();
            process.stdout.write("\n");
        };
        const onData = (typed : string) => {
            for (const character of typed) {
                if (character === "\r" || character === "\n") { finish(); resolve(value); return; }
                if (character === "") { finish(); process.exit(130); }
                if (character === "" || character === "\b") { value = value.slice(0, -1); continue; }
                value += character;
            }
        };

        process.stdout.write(`${question} ${dim("(not shown)")}: `);
        input.setRawMode(true);
        input.resume();
        input.setEncoding("utf8");
        input.on("data", onData);
    });
};

export { ask, confirm, askHidden }
