import {afterEach, describe, expect, it, vi} from "vitest";
import {AuditInteraction} from "anbaric-tsapi";
import {ConsoleAuditor} from "../src/auditing/ConsoleAuditor";
import {Code} from "../src/actors/Code";
import {Human} from "../src/actors/Human";

describe("ConsoleAuditor", () => {

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("logs the resource, actor, interaction and description", async () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        await new ConsoleAuditor().audit("job", "job-1", new Human("chris", "admin"), [AuditInteraction.UPDATE_PROPERTIES], "Properties updated", { age: 42 });

        expect(log).toHaveBeenCalledExactlyOnceWith('[job job-1] chris UPDATE_PROPERTIES Properties updated {"age":42}');
    });

    it("logs state changes made by the machine", async () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});

        await new ConsoleAuditor().audit("job", "job-1", new Code("workflow-1", "state-machine"), [AuditInteraction.CHANGE_STATE], 'Transitioned to "done"', null);

        expect(log).toHaveBeenCalledExactlyOnceWith('[job job-1] workflow-1 CHANGE_STATE Transitioned to "done" null');
    });

});
