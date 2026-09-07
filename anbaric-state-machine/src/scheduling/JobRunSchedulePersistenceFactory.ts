import {JobRunSchedulePersistence} from "anbaric-tsapi";
import {CloudJobRunSchedulePersistence} from "anbaric-impl-cloud";
import {InMemoryJobRunSchedulePersistence} from "./InMemoryJobRunSchedulePersistence.js";

const JobRunSchedulePersistenceFactory = {
    instance() : JobRunSchedulePersistence {
        switch (process.env.ANBARIC_JOB_RUN_SCHEDULE_PERSISTENCE_TYPE) {
            case "cloud":
                return new CloudJobRunSchedulePersistence();
            case "memory":
            default:
                return new InMemoryJobRunSchedulePersistence();
        }
    }
}

export { JobRunSchedulePersistenceFactory };
