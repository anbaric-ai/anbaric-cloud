import {JobPersistence} from "anbaric-tsapi";
import {CloudJobPersistence} from "anbaric-impl-cloud";
import {InMemoryJobPersistence} from "./InMemoryJobPersistence";
import {AuditorFactory} from "../auditing/AuditorFactory";

const JobPersistenceFactory = {
    instance() : JobPersistence {
        const auditor = AuditorFactory.instance();
        switch (process.env.ANBARIC_JOB_PERSISTENCE_TYPE) {
            case "cloud":
                return new CloudJobPersistence(undefined, auditor);
            case "memory":
            default:
                return new InMemoryJobPersistence(auditor);
        }
    }
}

export { JobPersistenceFactory };
