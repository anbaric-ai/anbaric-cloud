import {JobPersistence} from "anbaric-tsapi";
import {InMemoryJobPersistence} from "./InMemoryJobPersistence";

const JobPersistenceFactory = {
    instance() : JobPersistence {
        switch (process.env.ANBARIC_JOB_PERSISTENCE_TYPE) {
            case "postgres":
                throw new Error("Not implemented");
                break;
            case "memory":
            default:
                return new InMemoryJobPersistence();
        }
    }
}

export { JobPersistenceFactory };