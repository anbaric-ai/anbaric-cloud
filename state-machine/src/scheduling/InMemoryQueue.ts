import {Queue} from "anbaric-tsapi";

class InMemoryQueue implements Queue {

    private ready : Array<string> = [];
    private scheduled : Array<{ job : string, due : Date }> = [];

    enqueue(job : string) : void {
        this.ready.push(job);
    }

    schedule(job : string, due : Date) : void {
        this.scheduled.push({ job, due });
    }

    dequeueSome() : Array<string> {
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
