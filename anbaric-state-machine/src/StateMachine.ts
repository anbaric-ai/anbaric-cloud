import {
    Action,
    Actor,
    AppAware,
    Auditor,
    Await,
    Consumer,
    currentAppId,
    Job,
    JobPersistence,
    Notifier,
    PropertyDefinition,
    Queue,
    Reads,
    State,
    SystemActor,
    WorkflowDefinition
} from "anbaric-tsapi";

import {JobPersistenceFactory} from "./persistence/JobPersistenceFactory.js";
import {QueueFactory} from "./scheduling/QueueFactory.js";
import {NotifierFactory} from "./notifications/NotifierFactory.js";
import {ConsumerFactory} from "./scheduling/ConsumerFactory.js";
import {AuditorFactory} from "./auditing/AuditorFactory.js";
import {Code} from "./actors/Code.js";

class StateMachine implements AppAware {

    readonly workflowId: string;
    readonly states: Map<string, State>;
    readonly startState: string;
    readonly dataSchema: Map<string, PropertyDefinition>;

    private persistence: JobPersistence;
    private queue: Queue;
    private consumer: Consumer;
    private machineActor: Code;
    private notifier: Notifier | undefined;
    private auditor: Auditor;

    private readonly NO_TRANSITION_REQUEUE_DELAY: number = 5 * 60_000;

    constructor(workflowId : string, states : Array<State>, startState? : string, dataSchema : Array<PropertyDefinition> = [], persistence : JobPersistence = JobPersistenceFactory.instance(), queue : Queue = QueueFactory.instance(), notifier : Notifier | undefined = NotifierFactory.instance(), auditor : Auditor = AuditorFactory.instance()) {

        // The workflow's identity is the composite (appId, workflowId): the app
        // it is deployed in (from the environment, via getAppId()) and the
        // machine's own id, kept as separate values rather than a concatenated
        // string.
        this.workflowId = workflowId;
        this.states = new Map(states.map(state => [state.id, state]));
        this.startState = startState ?? states[0].id;
        this.dataSchema = new Map(dataSchema.map(property => [property.id, property]));
        this.persistence = persistence;
        this.queue = queue;
        this.notifier = notifier;
        this.machineActor = new Code(this.workflowId, "state-machine");
        this.auditor = auditor;

        this.consumer = ConsumerFactory.instance(queue)
        this.consumer.subscribe(this.getAppId(), this.workflowId, jobId => this.progressJob(jobId));

        void this.auditor.audit(this.getAppId(), "state-machine", this.workflowId, SystemActor.actor, ["INITIALIZE"],
            "State machine initialised", this.describe()).catch(() => {});
    }

    getAppId() : string {
        return currentAppId();
    }

    private describe() : WorkflowDefinition {
        return WorkflowDefinition.describe(this.getAppId(), this.workflowId, this.startState,
            [...this.states.values()], [...this.dataSchema.values()]);
    }

    async startJob(properties?: Map<string, any>, actor : Actor = this.machineActor): Promise<Job> {

        const job = new Job(crypto.randomUUID(), properties, this.startState, this.workflowId,
            this.getAppId(), actor?.id ?? this.workflowId);

        if (! this.validateProperties(properties ?? new Map(), true)) throw new Error("Invalid properties");
        if (! this.authorizeActor(actor, job)) throw new Error("Unauthorized");

        await this.persistence.create(actor, job);
        await this.queue.enqueue(job.id, this.getAppId(), this.workflowId);

        return job;
    }

    async updateJob(jobId : string, properties : Map<string, any>, actor : Actor) : Promise<void> {

        // Only the properties being changed are read: their old values are
        // what the audit trail records the change against.
        const job = await this.persistence.retrieve(jobId, actor, [...properties.keys()]);

        if (!this.authorizeActor(actor, job)) throw new Error("Unauthorized");

        await this.updateJobInternal(actor, "Properties Updated", job, properties);
    }

    async executeAction(jobId : string, action : Action) : Promise<void> {

        const job = await this.persistence.retrieve(jobId, action.actor, this.keysReadBy([action]));

        if (! action.predicate(job)) throw new Error("Action predicate unmet");
        if (! this.authorizeActor(action.actor, job)) throw new Error("Actor not authorized to execute action");

        const newProperties = await action.run(job);

        try {
            await this.updateJobInternal(action.actor, `Action ${action.name} executed on job ${job.id}: ${action.description}`, job, newProperties);
        } catch (error) {
            throw new Error('The action generated invalid properties');
        }
    }

    /* The properties a pass through a state needs: the union of what its
       actions, awaits and transitions declare they read. Undefined - load
       everything - as soon as any of them reads everything, since the store
       cannot be asked for "all" by name. The state is looked up by id before
       the job is read, so the read is as narrow as the state allows. */
    private keysReadBy(steps : Array<{ reads : Reads }>) : Array<string> | undefined {
        const definitions = [...this.dataSchema.values()];
        const keys = new Set<string>();

        for (const step of steps) {
            if (step.reads === Reads.everything) return undefined;
            const read = step.reads(definitions);
            if (definitions.length > 0 && definitions.every(definition => read.includes(definition.id))) return undefined;
            for (const key of read) keys.add(key);
        }
        return [...keys];
    }

    private keysReadIn(state : State | undefined) : Array<string> | undefined {
        if (! state) return undefined;
        return this.keysReadBy([...state.actions, ...state.transitions]);
    }

    private async progressJob(jobId : string) : Promise<void> {

        const stateOf = await this.persistence.retrieve(jobId, this.machineActor, []);
        if (stateOf.killed) return;

        const currentState = this.states.get(stateOf.state);
        if (currentState?.isTerminal) return;

        const job = await this.persistence.retrieve(jobId, this.machineActor, this.keysReadIn(currentState));

        // A job resuming from "Awaiting input" (re-enqueued by an update to its
        // properties) skips its actions entirely and only re-evaluates its
        // transitions - the input it was parked for drives it on.
        const wasAwaiting = job.status === Job.Status.AWAITING_INPUT;
        const involvedActors : Array<Actor> = [];
        // Only what changed is written back, never the properties the pass
        // happened to read - let alone the ones it never loaded.
        const changed = new Map<string, any>();

        if (! wasAwaiting) {
            for (const item of currentState?.actions ?? []) {
                if (item instanceof Await) {
                    job.status = Job.Status.AWAITING_INPUT;
                    job.awaitMetadata = item.waitForInput(job);
                    job.waitingFor = crypto.randomUUID();
                    await this.persistence.save(this.machineActor, `Job ${job.id} awaiting input`, job,
                        changed.size > 0 ? changed : undefined);
                    await this.notifyWaitingOn(item, job);
                    return;
                }

                if (! item.predicate(job)) continue;
                if (! this.authorizeActor(item.actor, job)) continue;

                let newProperties : Map<string, any>;

                try {
                    newProperties = await item.run(job);
                } catch (error) {
                    return this.failJob(job, item, error);
                }

                let applied = false;
                for (const [key, value] of newProperties) {
                    const problem = this.propertyProblem(key, value);
                    if (problem) {
                        console.warn(`[${this.workflowId}] action "${item.name}" set "${key}", which ${problem}, on job ${job.id} — skipping that property.`);
                        continue;
                    }
                    if (job.properties.has(key) && this.sameValue(job.properties.get(key), value)) continue;
                    job.properties.set(key, value);
                    changed.set(key, value);
                    applied = true;
                }

                if (applied) involvedActors.push(item.actor);
            }
        }

        let newState : string | undefined = undefined;
        for (const transition of currentState?.transitions ?? []) {
            if (! this.states.has(transition.to)) continue;
            if (transition.predicate(job)) {
                newState = transition.to;
                break;
            }
        }

        // TODO: persistence.save should have the ability to accept multiple actors for this case.
        if (newState !== undefined) {
            job.status = Job.Status.ACTIVE;
            job.awaitMetadata = undefined;
            job.waitingFor = undefined;
            await this.persistence.save(involvedActors[0] ?? this.machineActor, `Job ${job.id} progressed automatically`,
                job, changed.size > 0 ? changed : undefined, newState);
            if (! this.states.get(newState)?.isTerminal) await this.queue.enqueue(job.id, this.getAppId(), this.workflowId);
            return;
        }

        // Parked (still awaiting) or nothing changed: leave the job be until the
        // next update. Otherwise re-check this state after the back-off delay.
        if (wasAwaiting || changed.size === 0) return;

        await this.persistence.save(involvedActors[0] ?? this.machineActor, `Job ${job.id} progressed automatically`,
            job, changed);
        await this.queue.schedule(job.id, this.getAppId(), this.workflowId, new Date(Date.now() + this.NO_TRANSITION_REQUEUE_DELAY));
    }

    /* Told after the job is parked, so the people notified can act on it the
       moment they read the message. Notifying is a side channel: a notifier
       that fails must not undo a job that is already legitimately waiting, so
       the failure is logged and the job left alone. */
    private async notifyWaitingOn(waiting : Await, job : Job) : Promise<void> {
        if (!this.notifier || waiting.notify.length === 0 || !job.awaitMetadata) return;

        try {
            await this.notifier.notify(waiting.notify, job, job.awaitMetadata);
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.error(`[${this.workflowId}] could not notify ${waiting.notify.join(", ")} that job ${job.id} is waiting: ${reason}`);
        }
    }

    /* An action that throws used to leave the job silently stuck: the queue
       message was never confirmed, so the job neither advanced nor visibly
       failed. Failing it here marks the job, records why in the audit trail,
       and lets the consumer confirm the message. An update that moves the job
       on clears the status, so a failure is recoverable rather than terminal. */
    private async failJob(job : Job, action : Action, error : unknown) : Promise<void> {
        const reason = error instanceof Error ? error.message : String(error);

        job.status = Job.Status.FAILED;

        console.error(`[${this.workflowId}] action "${action.name}" threw on job ${job.id}: ${reason}`);
        await this.persistence.save(action.actor,
            `Action "${action.name}" failed on job ${job.id}: ${reason}`, job);
    }

    private async updateJobInternal(actor: Actor, message : string, job: Job, newProperties?: Map<string, any>, newState? : string) {

        if (newProperties && !this.validateProperties(newProperties, false)) throw new Error("Invalid properties");

        await this.persistence.save(actor, "Properties Updated", job, newProperties, newState)
        await this.queue.enqueue(job.id, this.getAppId(), this.workflowId);
    }

    private validateProperties(properties : Map<string, any>, isNew : boolean) : boolean {
        for (const [key, value] of properties) {
            if (this.propertyProblem(key, value)) return false;
        }

        if (! isNew) return true;

        for (const [key, definition] of this.dataSchema) {
            if (definition.required && ! properties.has(key)) return false;
        }

        return true;
    }

    private propertyProblem(key : string, value : any) : string | undefined {
        const definition = this.dataSchema.get(key);
        if (! definition) return "is not declared in the data schema";
        if (! definition.validation(value)) return "failed its validation";
        return undefined;
    }

    private sameValue(a : any, b : any) : boolean {
        return a === b || JSON.stringify(a) === JSON.stringify(b);
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
