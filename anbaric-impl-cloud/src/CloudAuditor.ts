import {Actor, Auditor} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudAuditor implements Auditor {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async audit(appId : string | undefined, resourceType : string, resourceId : string, actor : Actor,
                interaction : Array<string>, description : string, details : any) : Promise<void> {
        await this.client.request("POST", "/audits", {
            appId: appId || undefined,
            resourceType,
            resourceId,
            actorId: actor.id,
            actorType: actor.type,
            interaction,
            description,
            details: details ?? null,
        });
    }

}

export { CloudAuditor }
