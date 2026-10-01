import {afterEach, describe, expect, it, vi} from "vitest";
import {AuditRecordStore} from "../../src/auditing/AuditRecordStore";
import {AuditSweep} from "../../src/auditing/AuditSweep";

const DAY_MS = 24 * 60 * 60_000;

// Answers each deleteBefore call with the next count in turn, then zero.
const storeRemoving = (counts : Array<number | Error>) => {
    let call = 0;
    return {
        save: vi.fn(),
        list: vi.fn(),
        deleteBefore: vi.fn(async (_before : Date, _limit : number) => {
            const next = counts[call++] ?? 0;
            if (next instanceof Error) throw next;
            return next;
        }),
    } as unknown as AuditRecordStore;
};

describe("AuditSweep", () => {

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("removes records older than the retention and says how many", async () => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        const store = storeRemoving([3]);

        expect(await new AuditSweep(store, 90, undefined, 5_000).sweep()).toBe(3);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("removed 3 record(s) older than 90 days"));
    });

    it("asks for everything before the retention cut-off", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-01T12:00:00Z"));
        const store = storeRemoving([0]);

        await new AuditSweep(store, 30).sweep();

        const [before, limit] = (store.deleteBefore as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(before).toEqual(new Date(Date.now() - 30 * DAY_MS));
        expect(limit).toBe(5_000);
    });

    /* A full batch means there may be more, so the sweep goes again; a short
       one means the backlog is cleared. */
    it("keeps deleting in batches until a batch comes back short", async () => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        const store = storeRemoving([10, 10, 4]);

        expect(await new AuditSweep(store, 90, undefined, 10).sweep()).toBe(24);
        expect(store.deleteBefore).toHaveBeenCalledTimes(3);
    });

    it("says nothing when there was nothing to remove", async () => {
        vi.spyOn(console, "log").mockImplementation(() => {});

        expect(await new AuditSweep(storeRemoving([0]), 90).sweep()).toBe(0);
        expect(console.log).not.toHaveBeenCalled();
    });

    it("keeps everything when retention is zero", async () => {
        const store = storeRemoving([5]);
        const sweep = new AuditSweep(store, 0, 1_000);

        sweep.start();
        expect(await sweep.sweep()).toBe(0);
        expect(store.deleteBefore).not.toHaveBeenCalled();
    });

    it("survives a failing sweep, keeping what it had removed so far", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const store = storeRemoving([10, new Error("database gone")]);

        expect(await new AuditSweep(store, 90, undefined, 10).sweep()).toBe(10);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining("database gone"));
    });

    // A platform that restarts on every release would never reach a daily tick.
    it("sweeps once on start and then on its interval until stopped", async () => {
        vi.useFakeTimers();
        const store = storeRemoving([0, 0, 0, 0, 0, 0]);
        const sweep = new AuditSweep(store, 90, 1_000);

        sweep.start();
        await vi.advanceTimersByTimeAsync(3_000);
        expect(store.deleteBefore).toHaveBeenCalledTimes(4);

        await sweep.cleanUp();
        await vi.advanceTimersByTimeAsync(3_000);
        expect(store.deleteBefore).toHaveBeenCalledTimes(4);
    });

});
