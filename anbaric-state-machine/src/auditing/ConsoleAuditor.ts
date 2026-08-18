import {Actor, AuditInteraction, Auditor} from "anbaric-tsapi";

class ConsoleAuditor implements Auditor {

    async audit(resourceType : string, resourceId : string, actor : Actor, interaction : AuditInteraction[],
                description : string, details : any) : Promise<void> {
        console.log(`[${resourceType} ${resourceId}] ${actor.id} ${interaction.join(",")} ${description} ${JSON.stringify(details ?? null)}`);
    }

}

export { ConsoleAuditor }
