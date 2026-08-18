import {Actor} from "../actors/Actor";
import {AuditInteraction, Auditor} from "../auditing/Auditor";
import {Job} from "./Job";
import {SystemActor} from "../actors/SystemActor";

/* Persists jobs and audits every interaction. Public methods record the
   interaction against the injected auditor and then defer to the abstract
   ...Internal methods a concrete store implements. */
abstract class JobPersistence {

    constructor(protected auditor : Auditor) {
    }

    async create(actor : Actor,
               job : Job) : Promise<void> {

        await this.auditor.audit("job", job.id, actor, [AuditInteraction.CREATE], "Job created", job);

        this.saveInternal(job);
    }

    async save(actor : Actor,
               changeDescription : string,
               job : Job,
               properties? : Map<string, any>,
               state? : string) : Promise<void> {

        const change = {
            properties: properties ? this.generatePropertiesDiff(job.properties, properties) : undefined,
            state: state ? {from : job.state, to : state} : undefined
        }

        const interaction = [];
        if (properties) interaction.push(AuditInteraction.UPDATE_PROPERTIES);
        if (state) interaction.push(AuditInteraction.CHANGE_STATE);

        await this.auditor.audit("job", job.id, actor, interaction, changeDescription, change);

        const updatedJob = new Job(
            job.id,
            properties ? this.updateProperties(job.properties, properties) : job.properties,
            state ? state : job.state,
            job.workflowId,
            job.startedBy,
            job.startedAt,
            new Date()
        )

        this.saveInternal(updatedJob);
    }

    private generatePropertiesDiff(oldVersion : Map<string, any>, newVersion : Map<string, any>) : Map<string, {from: any, to: any}> {
        const diff: Map<string, { from: any; to: any; }> = new Map();

        for (const [key, value] of newVersion) {
            diff.set(key, {from: oldVersion.get(key), to: value});
        }
        return diff;
    }

    private updateProperties(oldVersion : Map<string, any>, newVersion : Map<string, any>) : Map<string, any> {
        const updated = new Map(oldVersion);
        for (const [key, value] of newVersion) {
            updated.set(key, value);
        }
        return updated;
    }

    async retrieve(id : string, actor : Actor) : Promise<Job> {
        await this.auditor.audit("job", id, actor, [AuditInteraction.READ], "", null);
        return this.retrieveInternal(id);
    }

    async delete(id : string, actor : Actor) : Promise<void> {
        await this.auditor.audit("job", id, actor, [AuditInteraction.DELETE], "", null);
        await this.deleteInternal(id);
    }

    async list(actor : Actor, pageSize? : number, page? : number) : Promise<Array<Job>> {
        await this.auditor.audit("job", "*", actor, [AuditInteraction.LIST], "", null);
        return this.listInternal(pageSize, page);
    }

    protected abstract saveInternal(job : Job) : Promise<void>;
    protected abstract retrieveInternal(id : string) : Promise<Job>;
    protected abstract deleteInternal(id : string) : Promise<void>;
    protected abstract listInternal(pageSize? : number, page? : number) : Promise<Array<Job>>;

}

export { JobPersistence }
