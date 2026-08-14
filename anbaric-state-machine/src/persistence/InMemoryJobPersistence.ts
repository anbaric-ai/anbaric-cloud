import {Job, JobPersistence} from "anbaric-tsapi";

class InMemoryJobPersistence implements JobPersistence {

    private jobs = new Map<string, Job>();

    async save(job : Job) : Promise<void> {
        this.jobs.set(job.id, job);
    }

    async retrieve(id : string) : Promise<Job> {
        const job = this.jobs.get(id);
        if (!job) {
            throw new Error(`No job found with id "${id}"`);
        }
        return job;
    }

    async delete(id : string) : Promise<void> {
        this.jobs.delete(id);
    }

    async list(pageSize : number = 100, page : number = 0) : Promise<Array<Job>> {
        return Array.from(this.jobs.values()).slice(page * pageSize, (page + 1) * pageSize);
    }

    async updateProperties(id : string, properties : Map<string, any>) : Promise<void> {
        const job = await this.retrieve(id);
        for (const [key, value] of properties) {
            job.properties.set(key, value);
        }
    }

}

export { InMemoryJobPersistence }
