import {Action, Actor, Consumer, Job, JobPersistence, PropertyDefinition, Queue, State} from "anbaric-tsapi";
import {JobPersistenceFactory} from "./persistence/JobPersistenceFactory";
import {QueueFactory} from "./scheduling/QueueFactory";
import {ConsumerFactory} from "./scheduling/ConsumerFactory";
import {Auditor} from "./auditing/Auditor";

class StateMachine {

    private workflowId: string;
    private states: Map<string, State>;
    private startState: string;
    private dataSchema: Map<string, PropertyDefinition>;
    private persistence: JobPersistence;
    private queue: Queue;
    private consumer: Consumer;

    constructor(workflowId : string, states : Array<State>, startState : string, dataSchema : Array<PropertyDefinition>, persistence : JobPersistence = JobPersistenceFactory.instance(), queue : Queue = QueueFactory.instance()) {

        this.workflowId = workflowId;
        this.states = new Map(states.map(state => [state.id, state]));
        this.startState = startState;
        this.dataSchema = new Map(dataSchema.map(property => [property.id, property]));
        this.persistence = persistence;
        this.queue = queue;

        this.consumer = ConsumerFactory.instance(queue)
        this.consumer.subscribe(workflowId, jobId => this.progressJob(jobId));
    }

    async startJob(properties?: Map<string, any>, actor? : Actor): Promise<Job> {

        const job = new Job(crypto.randomUUID(), properties, this.startState, this.workflowId,
            actor?.id ?? this.workflowId);

        if (! this.validateProperties(properties ?? new Map(), true)) throw new Error("Invalid properties");

        if (! this.authorizeActor(actor, job)) {
            Auditor.instance().audit(job.id, actor, "Unauthorized start", null);
            throw new Error("Unauthorized");
        }

        await this.persistence.save(job);

        await this.queue.enqueue(job.id, this.workflowId);

        return job;
    }

    async updateJob(jobId : string, properties : Map<string, any>, actor : Actor) : Promise<void> {

        if (! this.authorizeActor(actor, await this.persistence.retrieve(jobId))) {
            Auditor.instance().audit(jobId, actor, "Unauthorized update", null);
            throw new Error("Unauthorized");
        }

        if (! this.validateProperties(properties, false)) throw new Error("Invalid properties");

        await this.persistence.updateProperties(jobId, properties);
        Auditor.instance().audit(jobId, actor, "Properties updated", Object.fromEntries(properties));

        await this.queue.enqueue(jobId, this.workflowId);
    }

    async executeAction(jobId : string, action : Action) : Promise<void> {
        const job = await this.persistence.retrieve(jobId);

        if (! action.predicate(job)) throw new Error("Action predicate unmet");

        if (! this.authorizeActor(action.actor, job)) {
            Auditor.instance().audit(jobId, action.actor, "Unauthorized update", null);
            throw new Error("Actor not authorized to execute action");
        }

        const newProperties = await action.run(job);

        if (! this.validateProperties(newProperties, false)) {
            Auditor.instance().audit(jobId, action.actor, "Invalid properties", Object.fromEntries(newProperties));
            throw new Error("The action generated invalid properties");
        }

        await this.persistence.updateProperties(jobId, newProperties);
        Auditor.instance().audit(jobId, action.actor, "Properties updated", Object.fromEntries(newProperties));

        await this.queue.enqueue(jobId, this.workflowId);
    }

    private validateProperties(properties : Map<string, any>, isNew : boolean) : boolean {
        for (const [key, value] of properties) {
            const definition = this.dataSchema.get(key);
            if (! definition || ! definition.validation(value)) return false;
        }

        if (! isNew) return true;

        for (const [key, definition] of this.dataSchema) {
            if (definition.required && ! properties.has(key)) return false;
        }

        return true;
    }

    private async progressJob(jobId : string) : Promise<void> {
        const auditTransaction = Auditor.instance().transaction();
        let pristine = true;

        const job = await this.persistence.retrieve(jobId);
        const currentState = this.states.get(job.stateId!);

        for (const action of currentState?.actions ?? []) {
            if (! action.predicate(job)) continue;

            if (! this.authorizeActor(action.actor, job)) {
                auditTransaction.audit(jobId, action.actor, "Unauthorized update", null);
                continue;
            }

            const newProperties = await action.run(job);

            if (! this.validateProperties(newProperties, false)) {
                auditTransaction.audit(jobId, action.actor, "Invalid properties", Object.fromEntries(newProperties));
                continue;
            }

            auditTransaction.audit(jobId, action.actor, "Properties updated", Object.fromEntries(newProperties));
            newProperties.forEach((value, key) => {
                pristine = false;
                job.properties.set(key, value);
            });
        }

        for (const transition of currentState?.transitions ?? []) {
            if (! this.states.has(transition.to)) continue;
            if (job.transition(transition)) {
                auditTransaction.audit(jobId, undefined, `Transitioned to "${transition.to}"`, null);
                pristine = false;
                break;
            }
        }

        if (! pristine) {
            await this.persistence.save(job);
            await this.queue.enqueue(job.id, this.workflowId);
        }

        auditTransaction.flush();
    }

    async cleanUp() : Promise<void> {
        await this.consumer.cleanUp();
    }

    private authorizeActor(actor: Actor | undefined, job: Job) : boolean {
        // TODO
        return true;
    }
}

export { StateMachine }
