import {describe, expect, it, vi} from "vitest";
import {JobRunSchedulePersistence, ScheduledRun} from "anbaric-tsapi";
import {InMemoryJobRunSchedulePersistence} from "../src/scheduling/InMemoryJobRunSchedulePersistence.js";
import {JobRunScheduler} from "../src/scheduling/JobRunScheduler.js";
import {Schedule} from "../src/scheduling/Schedule.js";

const at = (iso : string) => new Date(iso);

const machine = (workflowId : string, appId : string = "") => ({
    workflowId,
    getAppId: () => appId,
    startJob: vi.fn(async (properties? : Map<string, any>) => ({ id: "job-1", properties })),
}) as any;

const dailyAtNine = () => new Schedule(Schedule.everyDay(), [{ hours: 9, minutes: 0 }]);

// No offset, so planned times are exactly the schedule's times.
const exact : [number, number] = [0, 0];

describe("JobRunScheduler", () => {

    it("plans runs across the lookahead window", async () => {
        const persistence = new InMemoryJobRunSchedulePersistence();
        const scheduler = new JobRunScheduler(persistence);
        scheduler.schedule(machine("nightly"), dailyAtNine(), 1000 * 60 * 60 * 72, exact);

        await scheduler.tick(at("2026-03-01T00:00:00"));

        expect(await persistence.highWaterMark("", "nightly")).toEqual(at("2026-03-03T09:00:00"));
        await scheduler.cleanUp();
    });

    it("starts a job when a planned run comes due", async () => {
        const target = machine("nightly");
        const scheduler = new JobRunScheduler(new InMemoryJobRunSchedulePersistence());
        scheduler.schedule(target, dailyAtNine(), 1000 * 60 * 60 * 24, exact);

        await scheduler.tick(at("2026-03-01T08:00:00"));
        expect(target.startJob).not.toHaveBeenCalled();

        await scheduler.tick(at("2026-03-01T09:00:00"));

        expect(target.startJob).toHaveBeenCalledTimes(1);
        await scheduler.cleanUp();
    });

    it("tells the job which run it is for", async () => {
        const target = machine("nightly");
        const scheduler = new JobRunScheduler(new InMemoryJobRunSchedulePersistence());
        scheduler.schedule(target, dailyAtNine(), 1000 * 60 * 60 * 24, exact);

        await scheduler.tick(at("2026-03-01T08:00:00"));
        await scheduler.tick(at("2026-03-01T09:00:00"));

        expect(target.startJob.mock.calls[0][0].get("scheduledFor")).toBe(at("2026-03-01T09:00:00").toISOString());
        await scheduler.cleanUp();
    });

    it("does not start the same run twice", async () => {
        const target = machine("nightly");
        const scheduler = new JobRunScheduler(new InMemoryJobRunSchedulePersistence());
        scheduler.schedule(target, dailyAtNine(), 1000 * 60 * 60 * 24, exact);

        await scheduler.tick(at("2026-03-01T08:00:00"));
        await scheduler.tick(at("2026-03-01T09:00:00"));
        await scheduler.tick(at("2026-03-01T09:00:01"));

        expect(target.startJob).toHaveBeenCalledTimes(1);
        await scheduler.cleanUp();
    });

    it("does not re-plan runs that are already recorded", async () => {
        const persistence = new InMemoryJobRunSchedulePersistence();
        const plan = vi.spyOn(persistence, "plan");
        const scheduler = new JobRunScheduler(persistence);
        scheduler.schedule(machine("nightly"), dailyAtNine(), 1000 * 60 * 60 * 24, exact);

        await scheduler.tick(at("2026-03-01T00:00:00"));
        const plannedFirst = plan.mock.calls[0][0].length;
        await scheduler.tick(at("2026-03-01T00:00:30"));

        // The window barely moved, so the second tick has nothing new to add.
        expect(plannedFirst).toBeGreaterThan(0);
        expect(plan.mock.calls[1]?.[0] ?? []).toHaveLength(0);
        await scheduler.cleanUp();
    });

    it("catches up runs that fell due while it was not running", async () => {
        const target = machine("nightly");
        const scheduler = new JobRunScheduler(new InMemoryJobRunSchedulePersistence());
        scheduler.schedule(target, dailyAtNine(), 1000 * 60 * 60 * 72, exact);

        await scheduler.tick(at("2026-03-01T00:00:00"));
        await scheduler.tick(at("2026-03-03T12:00:00"));

        // The 1st, 2nd and 3rd were all planned and are all now due.
        expect(target.startJob).toHaveBeenCalledTimes(3);
        await scheduler.cleanUp();
    });

    it("keeps a machine's runs to itself", async () => {
        const nightly = machine("nightly");
        const weekly = machine("weekly");
        const scheduler = new JobRunScheduler(new InMemoryJobRunSchedulePersistence());
        scheduler.schedule(nightly, dailyAtNine(), 1000 * 60 * 60 * 24, exact);
        scheduler.schedule(weekly, new Schedule(Schedule.daysOfWeek([0]), [{ hours: 9, minutes: 0 }]),
            1000 * 60 * 60 * 24, exact);

        // 2026-03-02 is a Monday, so only the nightly machine is due.
        await scheduler.tick(at("2026-03-02T08:00:00"));
        await scheduler.tick(at("2026-03-02T09:00:00"));

        expect(nightly.startJob).toHaveBeenCalledTimes(1);
        expect(weekly.startJob).not.toHaveBeenCalled();
        await scheduler.cleanUp();
    });

    it("applies the random offset within its bounds", async () => {
        const persistence = new InMemoryJobRunSchedulePersistence();
        const scheduler = new JobRunScheduler(persistence);
        scheduler.schedule(machine("nightly"), dailyAtNine(), 1000 * 60 * 60 * 24, [0, 60_000]);

        await scheduler.tick(at("2026-03-01T00:00:00"));

        const planned = (await persistence.highWaterMark("", "nightly"))!.getTime();
        const scheduled = at("2026-03-01T09:00:00").getTime();
        expect(planned).toBeGreaterThanOrEqual(scheduled);
        expect(planned).toBeLessThanOrEqual(scheduled + 60_000);
        await scheduler.cleanUp();
    });

    // A run is planned only if it falls strictly after the moment it is planned
    // at, which is what stops consecutive windows planning it twice. The cost
    // is that a scheduler starting exactly on a run time does not claim that
    // run - it was not running when it came due.
    it("does not fire a run it was started exactly on top of", async () => {
        const target = machine("nightly");
        const scheduler = new JobRunScheduler(new InMemoryJobRunSchedulePersistence());
        scheduler.schedule(target, dailyAtNine(), 1000 * 60 * 60 * 24, exact);

        await scheduler.tick(at("2026-03-01T09:00:00"));

        expect(target.startJob).not.toHaveBeenCalled();
        await scheduler.cleanUp();
    });

    it("ignores a due run whose machine is no longer scheduled", async () => {
        const persistence : JobRunSchedulePersistence = {
            highWaterMark: async () => undefined,
            plan: async () => {},
            claimDue: async () : Promise<Array<ScheduledRun>> =>
                [{ appId: "", workflowId: "forgotten", runAt: at("2026-03-01T09:00:00") }],
        };
        const scheduler = new JobRunScheduler(persistence);

        await expect(scheduler.tick(at("2026-03-01T09:00:00"))).resolves.toBeUndefined();
        await scheduler.cleanUp();
    });

});
