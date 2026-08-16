import {Actor, Auditor} from "anbaric-tsapi";

class ConsoleAuditor implements Auditor {

    async audit(jobId : string, actor : Actor | undefined, changeDescription : string, details : any) : Promise<void> {
        console.log(`[${jobId}] ${actor?.id ?? "anonymous"} ${changeDescription} ${JSON.stringify(details ?? null)}`);
    }

}

export { ConsoleAuditor }
