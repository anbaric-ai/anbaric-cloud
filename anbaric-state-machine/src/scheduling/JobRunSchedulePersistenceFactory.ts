import {JobRunSchedulePersistence} from "anbaric-tsapi";
import {InMemoryJobRunSchedulePersistence} from "./InMemoryJobRunSchedulePersistence.js";

const JobRunSchedulePersistenceFactory = {
    instance() : JobRunSchedulePersistence {
        switch (process.env.ANBARIC_JOB_RUN_SCHEDULE_PERSISTENCE_TYPE) {
            case "cloud":
                throw new Error("There is no cloud job-run-schedule persistence yet - unset ANBARIC_JOB_RUN_SCHEDULE_PERSISTENCE_TYPE to schedule in memory");
            case "memory":
            default:
                return new InMemoryJobRunSchedulePersistence();
        }
    }
}

export { JobRunSchedulePersistenceFactory };
