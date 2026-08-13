import {Job, JobPersistence} from "anbaric-tsapi";

class InMemoryJobPersistence implements JobPersistence {

    private jobs = new Map<string, Job>();

    save(job : Job) : void {
        this.jobs.set(job.id, job);
    }

    retrieve(id : string) : Job {
        const job = this.jobs.get(id);
        if (!job) {
            throw new Error(`No job found with id "${id}"`);
        }
        return job;
    }

    delete(id : string) : void {
        this.jobs.delete(id);
    }

    list(pageSize : number = 100, page : number = 0) : Array<Job> {
        return Array.from(this.jobs.values()).slice(page * pageSize, (page + 1) * pageSize);
    }

    updateProperties(id : string, properties : Map<string, any>) : void {
        const job = this.retrieve(id);
        for (const [key, value] of properties) {
            job.properties.set(key, value);
        }
    }

}

export { InMemoryJobPersistence }
