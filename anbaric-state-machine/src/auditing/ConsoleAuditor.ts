import {Actor, AuditChange, Auditor} from "anbaric-tsapi";

class ConsoleAuditor implements Auditor {

    async audit(jobId : string, actor : Actor, change : AuditChange,
                changeDescription : string, details : any) : Promise<void> {
        console.log(`[${jobId}] ${actor.id} ${change} ${changeDescription} ${JSON.stringify(details ?? null)}`);
    }

}

export { ConsoleAuditor }
