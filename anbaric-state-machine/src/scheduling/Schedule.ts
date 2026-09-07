type TimeOfDay = { hours : number, minutes : number };

/* Which days a machine runs on and at what times. The day test and the times
   are separate so "weekdays at 09:00 and 17:00" and "the 1st of the month at
   midnight" are the same shape. */
class Schedule {

    constructor(private dayTest : (date : Date) => boolean, private times : Array<TimeOfDay>) {}

    // Runs strictly after `from` and up to and including `to`, in order.
    getRuns(from : Date, to : Date) : Array<Date> {
        const runs : Array<Date> = [];

        const day = new Date(from);
        day.setHours(0, 0, 0, 0);

        for (; day.getTime() <= to.getTime(); day.setDate(day.getDate() + 1)) {
            if (!this.dayTest(day)) continue;

            for (const time of this.times) {
                const run = new Date(day);
                run.setHours(time.hours, time.minutes, 0, 0);
                if (run.getTime() > from.getTime() && run.getTime() <= to.getTime()) runs.push(run);
            }
        }

        return runs.sort((left, right) => left.getTime() - right.getTime());
    }

    static daysOfWeek(days : Array<number>) {
        return (date : Date) => days.includes(date.getDay());
    }

    static daysOfMonth(days : Array<number>) {
        return (date : Date) => days.includes(date.getDate());
    }

    static everyDay() {
        return (_date : Date) => true;
    }

}

export { Schedule };
export type { TimeOfDay };
