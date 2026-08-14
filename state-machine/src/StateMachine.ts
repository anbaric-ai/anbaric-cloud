import {ActionResolver, Actor, Consumer, Job, JobPersistence, PropertyDefinition, Queue, State} from "anbaric-tsapi";
import {JobPersistenceFactory} from "./persistence/JobPersistenceFactory";
import {DefaultActionResolver} from "./actions/DefaultActionResolver";
import {QueueFactory} from "./scheduling/QueueFactory";
import {ConsumerFactory} from "./scheduling/ConsumerFactory";

class StateMachine {

    private workflowId: string;
    private states: Map<string, State>;
    private startState: string;
    private dataSchema: Map<string, PropertyDefinition>;
    private actionResolver: ActionResolver;
    private persistence: JobPersistence;
    private queue: Queue;
    private consumer: Consumer;

    constructor(workflowId : string, states : Array<State>, startState : string, dataSchema : Array<PropertyDefinition>, actionResolver : ActionResolver = new DefaultActionResolver(), persistence : JobPersistence = JobPersistenceFactory.instance(), queue : Queue = QueueFactory.instance(), consumer : Consumer = ConsumerFactory.instance(queue)) {

        this.workflowId = workflowId;
        this.states = new Map(states.map(state => [state.id, state]));
        this.startState = startState;
        this.dataSchema = new Map(dataSchema.map(property => [property.id, property]));
        this.actionResolver = actionResolver;
        this.persistence = persistence;
        this.queue = queue;
        this.consumer = consumer;

        consumer.subscribe(workflowId, jobId => this.progressJob(jobId));
    }

    async startJob(properties?: Map<string, any>, actor? : Actor): Promise<Job> {

        const job = new Job(crypto.randomUUID(), properties, this.startState, this.workflowId);

        this.validateProperties(properties ?? new Map(), true);
        this.authorizeActor(actor, job);

        await this.persistence.save(job);

        await this.queue.enqueue(job.id, this.workflowId);

        return job;
    }

    async updateJob(jobId : string, properties : Map<string, any>, actor? : Actor) : Promise<void> {
        this.authorizeActor(actor, await this.persistence.retrieve(jobId));
        this.validateProperties(properties, false);
        await this.persistence.updateProperties(jobId, properties);

        await this.queue.enqueue(jobId, this.workflowId);
    }

    private validateProperties(properties: Map<string, any>, isNew : boolean) {
        properties.forEach((value, key) => {
            if (! this.dataSchema.get(key)!.validation(value)) throw new Error(`Invalid value for property "${key}"`);
        });

        if (! isNew) return;

        this.dataSchema.forEach((property, key) => {
            if (property.required && !properties?.has(key)) throw new Error(`Missing required property "${key}"`)
        })
    }

    async progressJob(jobId : string) : Promise<void> {
        const job = await this.persistence.retrieve(jobId);
        const availableActions = this.states.get(job.stateId!)!.actions;
        const actionsToRun = this.actionResolver.resolve(availableActions, job);

        let mutableJob = job;
        actionsToRun.forEach(action => {
           mutableJob = action.run(mutableJob);
        });

        const transitions = this.states.get(job.stateId!)!.transitions;
        for (const transition of transitions) {
            if (mutableJob.transition(transition)) break;
        }

        await this.persistence.save(mutableJob);
    }

    async cleanUp() : Promise<void> {
        await this.consumer.cleanUp();
    }

    private authorizeActor(actor: Actor | undefined, job: Job) {
        if (job.id == "notyetimplemented") throw new Error("Not authorized");

        return;
    }
}

export { StateMachine }
