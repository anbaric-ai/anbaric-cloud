import {Actor, Auditor} from "anbaric-tsapi";

class ConsoleAuditor implements Auditor {

    async audit(appId : string | undefined, resourceType : string, resourceId : string, actor : Actor,
                interaction : Array<string>, description : string, details : any) : Promise<void> {
        const scope = appId ? `${appId}/` : "";
        console.log(`[${scope}${resourceType} ${resourceId}] ${actor.id} ${interaction.join(",")} ${description} ${JSON.stringify(details ?? null)}`);
    }

}

export { ConsoleAuditor }
