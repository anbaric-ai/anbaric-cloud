import {describe, expect, it} from "vitest";
import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {childLines} from "../../src/app-management/childLines";

const fakeChild = () => {
    const child = new EventEmitter() as any;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => child.emit("close");
    return child;
};

describe("childLines", () => {

    it("yields stdout and stderr lines, reassembling split chunks, until close", async () => {
        const child = fakeChild();
        const collected : Array<string> = [];
        const draining = (async () => {
            for await (const line of childLines(child, new AbortController().signal)) collected.push(line);
        })();

        child.stdout.write("hello\nwor");
        child.stderr.write("a warning\n");
        child.stdout.write("ld\n");
        child.emit("close");

        await draining;
        expect(collected).toContain("hello");
        expect(collected).toContain("world");
        expect(collected).toContain("a warning");
    });

    it("stops and kills the process when the signal aborts", async () => {
        const child = fakeChild();
        let killed = false;
        child.kill = () => { killed = true; child.emit("close"); };
        const controller = new AbortController();

        const draining = (async () => {
            for await (const _ of childLines(child, controller.signal)) { /* drain */ }
        })();

        controller.abort();
        await draining;
        expect(killed).toBe(true);
    });

});
