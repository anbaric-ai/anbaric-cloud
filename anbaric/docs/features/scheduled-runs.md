# Scheduled runs

Some work isn't started by a person or an event — it just needs to happen at a
certain time. A nightly reconciliation, a weekly digest, an invoice run on the
1st of the month. The **job run scheduler** starts jobs on a timetable, so a
machine that should run at 09:00 gets a job at 09:00 without anything asking it
to.

## Scheduling a machine

Give the scheduler a machine and a `Schedule`:

```ts
import {JobRunScheduler, Schedule, StateMachine} from "anbaric";

const reconciliation = new StateMachine("reconciliation", [/* … */]);

JobRunScheduler.instance().schedule(
    reconciliation,
    new Schedule(Schedule.everyDay(), [{ hours: 2, minutes: 0 }]),
);
```

That's it. From then on a job is started on `reconciliation` at 02:00 every day,
in its start state, and progresses like any other job.

## Describing a timetable

A `Schedule` is **which days** and **what times on those days**, kept separate so
one shape covers everything:

```ts
new Schedule(Schedule.everyDay(), [{ hours: 9, minutes: 0 }]);                       // 09:00 daily
new Schedule(Schedule.daysOfWeek([1, 2, 3, 4, 5]), [{ hours: 9, minutes: 0 },
                                                    { hours: 17, minutes: 30 }]);    // weekdays, twice
new Schedule(Schedule.daysOfMonth([1]), [{ hours: 0, minutes: 0 }]);                 // the 1st, midnight
```

`daysOfWeek` takes 0 (Sunday) to 6 (Saturday); `daysOfMonth` takes calendar
dates. The day test is just a predicate, so anything you can express in code —
last working day of the quarter, every other Tuesday — is a schedule:

```ts
const quarterEnd = (date : Date) => [2, 5, 8, 11].includes(date.getMonth()) && date.getDate() === 28;
new Schedule(quarterEnd, [{ hours: 23, minutes: 0 }]);
```

## Runs are planned before they happen

The scheduler doesn't wake up and ask "is anything due?". It **plans ahead** —
by default a day at a time — writing each future run to storage, then starts
runs as they come due. Two things follow from that, both deliberate:

- **A restart doesn't lose the timetable.** The plan is already stored, so the
  scheduler picks up where it left off.
- **Downtime doesn't silently skip runs.** A scheduler that was down for two
  days starts the runs it missed as soon as it comes back, rather than
  pretending they never existed. If you don't want that catch-up for a
  particular machine, make its action check `scheduledFor` and return early.

Every scheduled job carries the run it belongs to:

```ts
processRun.run = async (job) => {
    const scheduledFor = new Date(job.properties.get("scheduledFor"));
    // …reconcile everything up to scheduledFor
};
```

## Spreading the load

Machines scheduled at the same time would otherwise all start on the same
second. Each machine gets a small random offset — up to two minutes by default —
applied **when the run is planned**, so the stored time is the time it really
runs. Control it per machine:

```ts
JobRunScheduler.instance().schedule(
    digest,
    new Schedule(Schedule.everyDay(), [{ hours: 6, minutes: 0 }]),
    1000 * 60 * 60 * 24,   // plan a day ahead
    [0, 1000 * 60 * 15],   // start somewhere in the 15 minutes after 06:00
);
```

Pass `[0, 0]` for a machine that must start exactly on the minute.

## Local and deployed

Like every other service, the scheduler resolves its storage through a factory.
Locally the plan is held in memory, so scheduling works on your laptop with no
setup — though a plan in memory dies with the process. Deployed, the platform
sets `ANBARIC_JOB_RUN_SCHEDULE_PERSISTENCE_TYPE=cloud` and the plan lives in the
platform database, surviving restarts and redeploys. **Your code is identical
either way** — see [Environment and factories](../api/environment.md).

Because the plan is shared, more than one instance of your app can run the
scheduler safely: claiming a due run is atomic, so each run is started exactly
once no matter how many instances are up.

## Scheduling and queueing are different things

A scheduled run is a **timetable entry**: "this machine should get a job at
09:00". `Queue.schedule` delays an **existing job**: "look at this job again in
ten minutes". Reach for the scheduler when the trigger is the clock, and for a
delayed enqueue when a job needs to wait before continuing.
