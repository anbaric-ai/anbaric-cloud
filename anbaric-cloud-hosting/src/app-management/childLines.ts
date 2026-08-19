import {ChildProcessWithoutNullStreams} from "node:child_process";

/* Yields the child's stdout and stderr merged, one line at a time, until the
   process ends or the signal aborts (which kills it). Backs the docker-logs
   follow stream. */
async function* childLines(child : ChildProcessWithoutNullStreams, signal : AbortSignal) : AsyncGenerator<string> {
    const queue : Array<string> = [];
    let wake : (() => void) | undefined;
    let ended = false;

    const push = (line : string) => { queue.push(line); wake?.(); wake = undefined; };
    const finish = () => { ended = true; wake?.(); wake = undefined; };

    for (const stream of [child.stdout, child.stderr]) {
        let buffer = "";
        stream.setEncoding("utf8");
        stream.on("data", chunk => {
            buffer += chunk;
            let newline : number;
            while ((newline = buffer.indexOf("\n")) >= 0) {
                push(buffer.slice(0, newline));
                buffer = buffer.slice(newline + 1);
            }
        });
    }

    child.on("close", finish);
    child.on("error", finish);
    const abort = () => { child.kill(); finish(); };
    signal.addEventListener("abort", abort);

    try {
        while (!ended || queue.length > 0) {
            if (queue.length > 0) yield queue.shift()!;
            else await new Promise<void>(resolve => { wake = resolve; });
        }
    } finally {
        signal.removeEventListener("abort", abort);
    }
}

export { childLines };
