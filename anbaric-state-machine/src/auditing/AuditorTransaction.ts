import {Actor, AuditChange, Auditor} from "anbaric-tsapi";

type BufferedEntry = {
    jobId : string,
    actor : Actor,
    change : AuditChange,
    changeDescription : string,
    details : any,
};

class AuditorTransaction {

    private entries = new Array<BufferedEntry>();

    constructor(private auditor : Auditor) {}

    audit(jobId : string, actor : Actor, change : AuditChange, changeDescription : string, details : any) : void {
        this.entries.push({ jobId, actor, change, changeDescription, details });
    }

    async flush() : Promise<void> {
        const flushing = this.entries;
        this.entries = [];
        for (const entry of flushing) {
            await this.auditor.audit(entry.jobId, entry.actor, entry.change, entry.changeDescription, entry.details);
        }
    }

}

export { AuditorTransaction }
