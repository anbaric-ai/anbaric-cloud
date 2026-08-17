import {Actor, AuditChange, Auditor} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudAuditor implements Auditor {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async audit(jobId : string, actor : Actor, change : AuditChange,
                changeDescription : string, details : any) : Promise<void> {
        await this.client.request("POST", "/audits", {
            jobId,
            actorId: actor.id,
            actorType: actor.type,
            change,
            description: changeDescription,
            details: details ?? null,
        });
    }

}

export { CloudAuditor }
