import {Actor} from "anbaric-tsapi";
import {AuditorTransaction} from "./AuditorTransaction";

class Auditor {

    private static singleton? : Auditor;

    static instance() : Auditor {
        if (!Auditor.singleton) {
            Auditor.singleton = new Auditor();
        }
        return Auditor.singleton;
    }

    audit(jobId : string, actor : Actor | undefined, changeDescription : string, details : any) : void {
        console.log(`[${jobId}] ${actor?.id ?? "anonymous"} ${changeDescription} ${JSON.stringify(details ?? null)}`);
    }

    transaction() : AuditorTransaction {
        return new AuditorTransaction(this);
    }

}

export { Auditor }
