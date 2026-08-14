import {describe, expect, it, vi} from "vitest";
import {Auditor} from "../src/auditing/Auditor";
import {AuditorTransaction} from "../src/auditing/AuditorTransaction";
import {Human} from "../src/actors/Human";

const mockAuditor = () => ({
    audit: vi.fn(),
}) as unknown as Auditor;

describe("AuditorTransaction", () => {

    it("holds entries back until flushed", () => {
        const auditor = mockAuditor();
        const transaction = new AuditorTransaction(auditor);

        transaction.audit("job-1", new Human("chris", "admin"), "Properties updated", { age: 42 });

        expect(auditor.audit).not.toHaveBeenCalled();
    });

    it("flushes entries to the auditor in order", () => {
        const auditor = mockAuditor();
        const transaction = new AuditorTransaction(auditor);
        const actor = new Human("chris", "admin");

        transaction.audit("job-1", actor, "first", null);
        transaction.audit("job-1", actor, "second", null);
        transaction.flush();

        expect(vi.mocked(auditor.audit).mock.calls).toEqual([
            ["job-1", actor, "first", null],
            ["job-1", actor, "second", null],
        ]);
    });

    it("does not replay entries on a second flush", () => {
        const auditor = mockAuditor();
        const transaction = new AuditorTransaction(auditor);

        transaction.audit("job-1", undefined, "once", null);
        transaction.flush();
        transaction.flush();

        expect(auditor.audit).toHaveBeenCalledOnce();
    });

});
