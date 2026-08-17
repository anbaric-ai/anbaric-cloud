import {describe, expect, it, vi} from "vitest";
import {Auditor} from "anbaric-tsapi";
import {AuditorTransaction} from "../src/auditing/AuditorTransaction";
import {Human} from "../src/actors/Human";

const mockAuditor = () => ({
    audit: vi.fn(async () => {}),
}) satisfies Auditor;

describe("AuditorTransaction", () => {

    it("holds entries back until flushed", () => {
        const auditor = mockAuditor();
        const transaction = new AuditorTransaction(auditor);

        transaction.audit("job-1", new Human("chris", "admin"), "UPDATE_PROPERTIES", "Properties updated", { age: 42 });

        expect(auditor.audit).not.toHaveBeenCalled();
    });

    it("flushes entries to the auditor in order", async () => {
        const auditor = mockAuditor();
        const transaction = new AuditorTransaction(auditor);
        const actor = new Human("chris", "admin");

        transaction.audit("job-1", actor, "UPDATE_PROPERTIES", "first", null);
        transaction.audit("job-1", actor, "CHANGE_STATE", "second", null);
        await transaction.flush();

        expect(vi.mocked(auditor.audit).mock.calls).toEqual([
            ["job-1", actor, "UPDATE_PROPERTIES", "first", null],
            ["job-1", actor, "CHANGE_STATE", "second", null],
        ]);
    });

    it("does not replay entries on a second flush", async () => {
        const auditor = mockAuditor();
        const transaction = new AuditorTransaction(auditor);

        transaction.audit("job-1", new Human("chris", "admin"), "CREATE", "once", null);
        await transaction.flush();
        await transaction.flush();

        expect(auditor.audit).toHaveBeenCalledOnce();
    });

});
