import {Queue} from "anbaric-tsapi";

class InMemoryQueue implements Queue {

    private ready : Array<string> = [];
    private scheduled : Array<{ job : string, due : Date }> = [];

    async enqueue(job : string) : Promise<void> {
        this.ready.push(job);
    }

    async schedule(job : string, due : Date) : Promise<void> {
        this.scheduled.push({ job, due });
    }

    async dequeueSome() : Promise<Array<string>> {
        const now = new Date();
        const released = this.scheduled
            .filter((entry) => entry.due <= now)
            .sort((a, b) => a.due.getTime() - b.due.getTime());
        this.scheduled = this.scheduled.filter((entry) => entry.due > now);
        const jobs = [...this.ready, ...released.map((entry) => entry.job)];
        this.ready = [];
        return jobs;
    }

}

export { InMemoryQueue }
