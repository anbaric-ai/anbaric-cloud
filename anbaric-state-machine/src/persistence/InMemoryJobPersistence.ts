import {Auditor, Job, JobPersistence, NoOpAuditor} from "anbaric-tsapi";

class InMemoryJobPersistence extends JobPersistence {

    private jobs = new Map<string, Job>();

    constructor(auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
    }

    protected async saveInternal(job : Job) : Promise<void> {
        this.jobs.set(job.id, job);
    }

    protected async retrieveInternal(id : string) : Promise<Job> {
        const job = this.jobs.get(id);
        if (!job) {
            throw new Error(`No job found with id "${id}"`);
        }
        return job;
    }

    protected async deleteInternal(id : string) : Promise<void> {
        this.jobs.delete(id);
    }

    protected async listInternal(pageSize : number = 100, page : number = 0) : Promise<Array<Job>> {
        return Array.from(this.jobs.values()).slice(page * pageSize, (page + 1) * pageSize);
    }

}

export { InMemoryJobPersistence }
