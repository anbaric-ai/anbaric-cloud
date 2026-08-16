import {Actor, Auditor} from "anbaric-tsapi";

type BufferedEntry = {
    jobId : string,
    actor : Actor | undefined,
    changeDescription : string,
    details : any,
};

class AuditorTransaction {

    private entries = new Array<BufferedEntry>();

    constructor(private auditor : Auditor) {}

    audit(jobId : string, actor : Actor | undefined, changeDescription : string, details : any) : void {
        this.entries.push({ jobId, actor, changeDescription, details });
    }

    async flush() : Promise<void> {
        const flushing = this.entries;
        this.entries = [];
        for (const entry of flushing) {
            await this.auditor.audit(entry.jobId, entry.actor, entry.changeDescription, entry.details);
        }
    }

}

export { AuditorTransaction }
