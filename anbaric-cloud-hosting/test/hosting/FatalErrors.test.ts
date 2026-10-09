import {EventEmitter} from "node:events";
import {describe, expect, it, vi} from "vitest";
import {FatalErrors} from "../../src/hosting/FatalErrors";

const installed = () => {
    const lines : Array<string> = [];
    const exit = vi.fn();
    const target = new EventEmitter() as unknown as NodeJS.Process;
    new FatalErrors(line => lines.push(line), exit).install(target);
    return { lines, exit, target };
};

describe("FatalErrors", () => {

    it("logs an uncaught exception as one searchable line and exits", () => {
        const { lines, exit, target } = installed();
        const error = Object.assign(new Error("Cannot write headers after they are sent to the client"), { code: "ERR_HTTP_HEADERS_SENT" });

        target.emit("uncaughtException", error);

        expect(lines).toHaveLength(1);
        expect(JSON.parse(lines[0])).toMatchObject({
            level: "fatal", event: "platform.crash", kind: "uncaughtException",
            message: "Cannot write headers after they are sent to the client", code: "ERR_HTTP_HEADERS_SENT",
        });
        expect(JSON.parse(lines[0]).stack).toContain("Error: Cannot write headers");
        expect(exit).toHaveBeenCalledWith(1);
    });

    it("does the same for a rejection nobody handled, even one that is not an Error", () => {
        const { lines, exit, target } = installed();

        target.emit("unhandledRejection", "fetch failed");

        expect(JSON.parse(lines[0])).toMatchObject({ event: "platform.crash", kind: "unhandledRejection", message: "fetch failed" });
        expect(exit).toHaveBeenCalledWith(1);
    });

    it("notes a stop signal without exiting itself", () => {
        const { lines, exit, target } = installed();

        target.emit("SIGTERM");

        expect(JSON.parse(lines[0])).toMatchObject({ event: "platform.stopping", signal: "SIGTERM" });
        expect(exit).not.toHaveBeenCalled();
    });

});
