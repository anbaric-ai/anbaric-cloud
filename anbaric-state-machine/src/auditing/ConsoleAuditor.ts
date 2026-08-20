import {Actor, Auditor} from "anbaric-tsapi";

class ConsoleAuditor implements Auditor {

    async audit(resourceType : string, resourceId : string, actor : Actor, interaction : Array<string>,
                description : string, details : any) : Promise<void> {
        console.log(`[${resourceType} ${resourceId}] ${actor.id} ${interaction.join(",")} ${description} ${JSON.stringify(details ?? null)}`);
    }

}

export { ConsoleAuditor }
