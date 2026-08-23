import {
    Action,
    Actor,
    Auditor,
    Consumer,
    Job,
    JobPersistence,
    PropertyDefinition,
    Queue,
    State,
    SystemActor,
    WorkflowDefinition
} from "anbaric-tsapi";
import {JobPersistenceFactory} from "./persistence/JobPersistenceFactory";
import {QueueFactory} from "./scheduling/QueueFactory";
import {ConsumerFactory} from "./scheduling/ConsumerFactory";
import {AuditorFactory} from "./auditing/AuditorFactory";
import {Code} from "./actors/Code";

class StateMachine {

    readonly workflowId: string;
    readonly states: Map<string, State>;
    readonly startState: string;
    readonly dataSchema: Map<string, PropertyDefinition>;

    private persistence: JobPersistence;
    private queue: Queue;
    private consumer: Consumer;
    private machineActor: Code;
    private sameStateDelayMs: number;
    private auditor: Auditor;

    constructor(workflowId : string, states : Array<State>, startState? : string, dataSchema : Array<PropertyDefinition> = [], persistence : JobPersistence = JobPersistenceFactory.instance(), queue : Queue = QueueFactory.instance(), sameStateDelayMs : number = 5 * 60_000, auditor : Auditor = AuditorFactory.instance()) {

        // A deployed app namespaces its state machines by app id, so the same
        // workflow id used in two different apps never collides. Run locally
        // (no app id in the environment) the id is used as given.
        const appId = process.env.ANBARIC_APP_ID;
        this.workflowId = appId ? `${appId}/${workflowId}` : workflowId;
        this.states = new Map(states.map(state => [state.id, state]));
        this.startState = startState ?? states[0].id;
        this.dataSchema = new Map(dataSchema.map(property => [property.id, property]));
        this.persistence = persistence;
        this.queue = queue;
        this.machineActor = new Code(this.workflowId, "state-machine");
        this.sameStateDelayMs = sameStateDelayMs;
        this.auditor = auditor;

        this.consumer = ConsumerFactory.instance(queue)
        this.consumer.subscribe(this.workflowId, jobId => this.progressJob(jobId));

        void this.auditor.audit("state-machine", this.workflowId, SystemActor.actor, ["INITIALIZE"],
            "State machine initialised", this.describe()).catch(() => {});
    }

    private describe() : WorkflowDefinition {
        return {
            workflowId: this.workflowId,
            startState: this.startState,
            dataSchema: [...this.dataSchema.values()].map(property => ({ id: property.id, required: property.required })),
            states: [...this.states.values()].map(state => ({
                id: state.id,
                isTerminal: state.isTerminal,
                actions: state.actions.map(action => ({
                    name: action.name,
                    description: action.description,
                    actor: { id: action.actor.id, type: action.actor.type, roles: action.actor.roles },
                })),
                transitions: state.transitions.map(transition => ({ to: transition.to })),
            })),
        };
    }

    async startJob(properties?: Map<string, any>, actor : Actor = this.machineActor): Promise<Job> {

        const job = new Job(crypto.randomUUID(), properties, this.startState, this.workflowId,
            actor?.id ?? this.workflowId);

        if (! this.validateProperties(properties ?? new Map(), true)) throw new Error("Invalid properties");
        if (! this.authorizeActor(actor, job)) throw new Error("Unauthorized");

        await this.persistence.create(actor, job);
        await this.queue.enqueue(job.id, this.workflowId);

        return job;
    }

    async updateJob(jobId : string, properties : Map<string, any>, actor : Actor) : Promise<void> {

        const job = await this.persistence.retrieve(jobId, actor);

        if (!this.authorizeActor(actor, job)) throw new Error("Unauthorized");

        await this.updateJobInternal(actor, "Properties Updated", job, properties);
    }

    async executeAction(jobId : string, action : Action) : Promise<void> {

        const job = await this.persistence.retrieve(jobId, action.actor);

        if (! action.predicate(job)) throw new Error("Action predicate unmet");
        if (! this.authorizeActor(action.actor, job)) throw new Error("Actor not authorized to execute action");

        const newProperties = await action.run(job);

        try {
            await this.updateJobInternal(action.actor, `Action ${action.name} executed on job ${job.id}: ${action.description}`, job, newProperties);
        } catch (error) {
            throw new Error('The action generated invalid properties');
        }
    }

    private async updateJobInternal(actor: Actor, message : string, job: Job, newProperties?: Map<string, any>, newState? : string) {

        if (newProperties && !this.validateProperties(newProperties, false)) throw new Error("Invalid properties");

        await this.persistence.save(actor, "Properties Updated", job, newProperties, newState)
        await this.queue.enqueue(job.id, this.workflowId);
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

    private async progressJob(jobId : string) : Promise<void> {
        let pristine = true;

        const job = await this.persistence.retrieve(jobId, this.machineActor);
        if (job.killed) return;

        const currentState = this.states.get(job.state);

        if (currentState?.isTerminal) return;

        const involvedActors : Actor[] = [];

        for (const action of currentState?.actions ?? []) {
            if (! action.predicate(job)) continue;
            if (! this.authorizeActor(action.actor, job)) continue;

            const newProperties = await action.run(job);

            let applied = false;
            for (const [key, value] of newProperties) {
                const problem = this.propertyProblem(key, value);
                if (problem) {
                    console.warn(`[${this.workflowId}] action "${action.name}" set "${key}", which ${problem}, on job ${job.id} — skipping that property.`);
                    continue;
                }
                if (job.properties.has(key) && this.sameValue(job.properties.get(key), value)) continue;
                job.properties.set(key, value);
                pristine = false;
                applied = true;
            }

            if (applied) involvedActors.push(action.actor);
        }

        let newState : string | undefined = undefined;
        for (const transition of currentState?.transitions ?? []) {
            if (! this.states.has(transition.to)) continue;
            if (transition.predicate(job)) {
                newState = transition.to;
                pristine = false;
                break;
            }
        }

        if (pristine) return;

        // TODO: persistence.save should have the ability to accept multiple actors for this case.
        await this.persistence.save(involvedActors[0] ?? this.machineActor, `Job ${job.id} progressed automatically`, job, job.properties, newState);

        if (this.states.get(newState ?? job.state)?.isTerminal) return;
        if (newState !== undefined) {
            await this.queue.enqueue(job.id, this.workflowId);
        } else {
            await this.queue.schedule(job.id, this.workflowId, new Date(Date.now() + this.sameStateDelayMs));
        }
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
