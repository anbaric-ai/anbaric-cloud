import {describe, expect, it} from "vitest";
import {Schedule} from "../src/scheduling/Schedule.js";

const at = (iso : string) => new Date(iso);

describe("Schedule", () => {

    it("returns each configured time on a matching day", () => {
        const schedule = new Schedule(Schedule.everyDay(), [{ hours: 9, minutes: 0 }, { hours: 17, minutes: 30 }]);

        const runs = schedule.getRuns(at("2026-03-02T00:00:00"), at("2026-03-02T23:59:59"));

        expect(runs.map(run => `${run.getHours()}:${String(run.getMinutes()).padStart(2, "0")}`))
            .toEqual(["9:00", "17:30"]);
    });

    it("skips days the day test rejects", () => {
        const weekdays = new Schedule(Schedule.daysOfWeek([1, 2, 3, 4, 5]), [{ hours: 9, minutes: 0 }]);

        // 7th and 8th of March 2026 are a Saturday and Sunday.
        const runs = weekdays.getRuns(at("2026-03-06T00:00:00"), at("2026-03-09T23:59:59"));

        expect(runs.map(run => run.getDate())).toEqual([6, 9]);
    });

    it("excludes a run exactly at `from` so consecutive windows do not repeat it", () => {
        const schedule = new Schedule(Schedule.everyDay(), [{ hours: 9, minutes: 0 }]);

        const runs = schedule.getRuns(at("2026-03-02T09:00:00"), at("2026-03-02T23:59:59"));

        expect(runs).toEqual([]);
    });

    it("includes a run exactly at `to`", () => {
        const schedule = new Schedule(Schedule.everyDay(), [{ hours: 9, minutes: 0 }]);

        const runs = schedule.getRuns(at("2026-03-02T00:00:00"), at("2026-03-02T09:00:00"));

        expect(runs).toHaveLength(1);
    });

    it("spans days, returning runs in order", () => {
        const schedule = new Schedule(Schedule.everyDay(), [{ hours: 8, minutes: 0 }]);

        const runs = schedule.getRuns(at("2026-03-01T00:00:00"), at("2026-03-04T12:00:00"));

        expect(runs.map(run => run.getDate())).toEqual([1, 2, 3, 4]);
    });

    it("matches days of the month", () => {
        const schedule = new Schedule(Schedule.daysOfMonth([1, 15]), [{ hours: 0, minutes: 0 }]);

        const runs = schedule.getRuns(at("2026-02-28T00:00:00"), at("2026-03-31T23:59:59"));

        expect(runs.map(run => `${run.getMonth() + 1}-${run.getDate()}`)).toEqual(["3-1", "3-15"]);
    });

    it("does not modify the dates it is given", () => {
        const schedule = new Schedule(Schedule.everyDay(), [{ hours: 9, minutes: 0 }]);
        const from = at("2026-03-02T10:00:00");
        const to = at("2026-03-05T10:00:00");

        schedule.getRuns(from, to);

        expect(from.toISOString()).toBe(at("2026-03-02T10:00:00").toISOString());
        expect(to.toISOString()).toBe(at("2026-03-05T10:00:00").toISOString());
    });

    it("returns nothing when the window is inverted", () => {
        const schedule = new Schedule(Schedule.everyDay(), [{ hours: 9, minutes: 0 }]);

        expect(schedule.getRuns(at("2026-03-05T00:00:00"), at("2026-03-02T00:00:00"))).toEqual([]);
    });

});
