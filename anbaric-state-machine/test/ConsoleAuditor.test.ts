import {afterEach, describe, expect, it, vi} from "vitest";
import {ConsoleAuditor} from "../src/auditing/ConsoleAuditor";
import {Human} from "../src/actors/Human";

describe("ConsoleAuditor", () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("logs the job, actor and change", async () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        await new ConsoleAuditor().audit("job-1", new Human("chris", "admin"), "Properties updated", { age: 42 });

        expect(log).toHaveBeenCalledExactlyOnceWith('[job-1] chris Properties updated {"age":42}');
    });

    it("logs anonymous when no actor is known", async () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        await new ConsoleAuditor().audit("job-1", undefined, "Unauthorized update", null);

        expect(log).toHaveBeenCalledExactlyOnceWith("[job-1] anonymous Unauthorized update null");
    });

});
