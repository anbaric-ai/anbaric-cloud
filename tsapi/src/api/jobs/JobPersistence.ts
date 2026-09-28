import {Actor} from "../actors/Actor.js";
import {Auditor} from "../auditing/Auditor.js";
import {Job} from "./Job.js";
import {serializeWaitForInput} from "../actions/WaitForInput.js";
import {currentAppId} from "../cloud/AppAware.js";

/* Persists jobs and audits every interaction. Public methods record the
   interaction against the injected auditor and then defer to the abstract
   ...Internal methods a concrete store implements. */
abstract class JobPersistence {

    constructor(protected auditor : Auditor) {
    }

    async create(actor : Actor,
               job : Job) : Promise<void> {

        await this.auditor.audit(job.appId, "job", job.id, actor, [JobPersistence.Interaction.CREATE], "Job created", job);

        await this.saveInternal(job, job.properties);
    }

    async save(actor : Actor,
               changeDescription : string,
               job : Job,
               properties? : Map<string, any>,
               state? : string) : Promise<void> {

        const change : { properties? : any, state? : any, metadata? : Record<string, any> } = {
            properties: properties ? this.generatePropertiesDiff(job.properties, properties) : undefined,
            state: state ? {from : job.state, to : state} : undefined
        }

        const interaction : Array<string> = [];
        if (properties) interaction.push(JobPersistence.Interaction.UPDATE_PROPERTIES);
        if (state) interaction.push(JobPersistence.Interaction.CHANGE_STATE);
        if (job.status === Job.Status.AWAITING_INPUT && job.awaitMetadata) {
            interaction.push(JobPersistence.Interaction.AWAIT);
            change.metadata = serializeWaitForInput(job.awaitMetadata);
        }

        await this.auditor.audit(job.appId, "job", job.id, actor, interaction, changeDescription, change);

        const updatedJob = new Job(
            job.id,
            properties ? this.updateProperties(job.properties, properties) : job.properties,
            state ? state : job.state,
            job.workflowId,
            job.appId,
            job.startedBy,
            job.startedAt,
            new Date(),
            job.killed,
            job.status,
            job.awaitMetadata,
            job.waitingFor
        )

        await this.saveInternal(updatedJob, properties);
    }

    async kill(id : string, actor : Actor) : Promise<void> {
        await this.auditor.audit(currentAppId(), "job", id, actor, [JobPersistence.Interaction.KILL], "Job killed", null);
        await this.killInternal(id);
    }

    async killOlderThan(lastUpdatedBefore : Date, actor : Actor) : Promise<number> {
        await this.auditor.audit(currentAppId(), "job", "*", actor, [JobPersistence.Interaction.KILL],
            `Jobs not updated since ${lastUpdatedBefore.toISOString()} killed`, null);
        return this.killOlderThanInternal(lastUpdatedBefore);
    }

    async countByState(actor : Actor) : Promise<Array<JobPersistence.StateCount>> {
        await this.auditor.audit(currentAppId(), "job", "*", actor, [JobPersistence.Interaction.LIST], "", null);
        return this.countByStateInternal();
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

    /* The job, with either every property or only the `keys` asked for. A job
       is read with the keys its next step declares it reads, so a job holding
       a great deal of data costs a step only what that step needs. A property
       that was not asked for is simply absent from the map. */
    async retrieve(id : string, actor : Actor, keys? : Array<string>) : Promise<Job> {
        await this.auditor.audit(currentAppId(), "job", id, actor, [JobPersistence.Interaction.READ], "", null);
        return this.retrieveInternal(id, keys);
    }

    async delete(id : string, actor : Actor) : Promise<void> {
        await this.auditor.audit(currentAppId(), "job", id, actor, [JobPersistence.Interaction.DELETE], "", null);
        await this.deleteInternal(id);
    }

    /* A page of jobs: `pageSize` of them (100 by default), page `page` (0 by
       default), oldest first unless the query says otherwise. Every job the
       store holds is reachable by paging - the size is a page, not a cap - and
       a page shorter than `pageSize` is the last one. The query narrows the
       set before paging, so page numbers count matching jobs only. */
    async list(actor : Actor, pageSize? : number, page? : number, query? : JobPersistence.Query) : Promise<Array<Job>> {
        await this.auditor.audit(currentAppId(), "job", "*", actor, [JobPersistence.Interaction.LIST], "", null);
        return this.listInternal(pageSize, page, query);
    }

    /* Writes the job's own columns, and upserts exactly the `properties` given -
       the ones that changed, or all of them on create. Properties the job was
       not read with are never touched, and none is ever removed: a store holds
       properties one by one, and a write is the changed ones. */
    protected abstract saveInternal(job : Job, properties? : Map<string, any>) : Promise<void>;
    protected abstract retrieveInternal(id : string, keys? : Array<string>) : Promise<Job>;
    protected abstract deleteInternal(id : string) : Promise<void>;
    protected abstract listInternal(pageSize? : number, page? : number, query? : JobPersistence.Query) : Promise<Array<Job>>;
    protected abstract killInternal(id : string) : Promise<void>;
    protected abstract killOlderThanInternal(lastUpdatedBefore : Date) : Promise<number>;
    protected abstract countByStateInternal() : Promise<Array<JobPersistence.StateCount>>;

}

namespace JobPersistence {

    /* What a listing is narrowed to. Every field is optional and they combine
       with AND; `order` is by when the job was started. */
    export type Query = {
        workflowId? : string,
        appId? : string,
        state? : string,
        status? : string,
        killed? : boolean,
        order? : "oldest" | "newest",
    };

    export enum Interaction {
        CREATE = "CREATE",
        UPDATE_PROPERTIES = "UPDATE_PROPERTIES",
        CHANGE_STATE = "CHANGE_STATE",
        AWAIT = "AWAIT",
        DELETE = "DELETE",
        READ = "READ",
        LIST = "LIST",
        KILL = "KILL",
    }

    export type StateCount = {
        state : string,
        killed : boolean,
        count : number,
    };

}

export { JobPersistence }
