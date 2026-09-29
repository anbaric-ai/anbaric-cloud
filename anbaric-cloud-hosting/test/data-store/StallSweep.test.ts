import {afterEach, describe, expect, it, vi} from "vitest";
import {PostgresJobPersistence} from "../../src/data-store/PostgresJobPersistence";
import {StallSweep} from "../../src/data-store/StallSweep";

const persistenceMarking = (marked : number | Error) => ({
    markStalled: vi.fn(async () => {
        if (marked instanceof Error) throw marked;
        return marked;
    }),
}) as unknown as PostgresJobPersistence;

describe("StallSweep", () => {

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it("marks stalled jobs and says how many", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const persistence = persistenceMarking(2);

        expect(await new StallSweep(persistence).sweep()).toBe(2);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("marked 2 job(s) stalled"));
    });

    it("says nothing when there is nothing to mark", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});

        expect(await new StallSweep(persistenceMarking(0)).sweep()).toBe(0);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it("survives a failing sweep, so the next one still runs", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const persistence = persistenceMarking(new Error("database gone"));

        expect(await new StallSweep(persistence).sweep()).toBe(0);
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining("database gone"));
    });

    it("sweeps on its interval until stopped", async () => {
        vi.useFakeTimers();
        const persistence = persistenceMarking(0);
        const sweep = new StallSweep(persistence, 1_000);

        sweep.start();
        await vi.advanceTimersByTimeAsync(3_000);
        expect(persistence.markStalled).toHaveBeenCalledTimes(3);

        await sweep.cleanUp();
        await vi.advanceTimersByTimeAsync(3_000);
        expect(persistence.markStalled).toHaveBeenCalledTimes(3);
    });

});
