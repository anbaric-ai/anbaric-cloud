import {afterEach, describe, expect, it, vi} from "vitest";
import {Auditor} from "../src/auditing/Auditor";
import {AuditorTransaction} from "../src/auditing/AuditorTransaction";
import {Human} from "../src/actors/Human";

describe("Auditor", () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("always returns the same instance", () => {
        expect(Auditor.instance()).toBe(Auditor.instance());
    });

    it("logs the job, actor and change", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        Auditor.instance().audit("job-1", new Human("chris", "admin"), "Properties updated", { age: 42 });

        expect(log).toHaveBeenCalledExactlyOnceWith('[job-1] chris Properties updated {"age":42}');
    });

    it("logs anonymous when no actor is known", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        Auditor.instance().audit("job-1", undefined, "Unauthorized update", null);

        expect(log).toHaveBeenCalledExactlyOnceWith("[job-1] anonymous Unauthorized update null");
    });

    it("hands out transactions bound to itself", () => {
        expect(Auditor.instance().transaction()).toBeInstanceOf(AuditorTransaction);
    });

});
