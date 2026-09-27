/* A run planned for a state machine: the machine it belongs to and the moment
   it should start. Runs are planned ahead of time and stored, so a restart
   resumes an existing plan rather than re-deriving it. */
type ScheduledRun = {
    appId : string,
    workflowId : string,
    runAt : Date,
};

interface JobRunSchedulePersistence {

    // The latest run already planned for a machine, so planning continues from
    // there instead of re-planning runs that are already recorded. Undefined
    // when nothing has ever been planned for it.
    highWaterMark(appId : string, workflowId : string) : Promise<Date | undefined>;

    plan(runs : Array<ScheduledRun>) : Promise<void>;

    // Runs due at or before `at`, marked as claimed so a second call does not
    // return them again - at most one per machine: when several of a
    // machine's runs have come due together (a scheduler that was down, a
    // deploy that took a while) only the most recent is claimed and the
    // earlier ones are marked superseded by it, so a backlog never becomes a
    // burst of jobs. A shared implementation makes the read-and-mark atomic,
    // so several schedulers can run against one store.
    claimDue(at : Date) : Promise<Array<ScheduledRun>>;

}

export type { JobRunSchedulePersistence, ScheduledRun };
