import {Actor} from "anbaric-tsapi";
import type {Auditor} from "./Auditor";

type AuditEntry = {
    jobId : string,
    actor : Actor | undefined,
    changeDescription : string,
    details : any,
};

class AuditorTransaction {

    private entries = new Array<AuditEntry>();

    constructor(private auditor : Auditor) {}

    audit(jobId : string, actor : Actor | undefined, changeDescription : string, details : any) : void {
        this.entries.push({ jobId, actor, changeDescription, details });
    }

    flush() : void {
        this.entries.forEach(entry =>
            this.auditor.audit(entry.jobId, entry.actor, entry.changeDescription, entry.details));
        this.entries = [];
    }

}

export { AuditorTransaction }
