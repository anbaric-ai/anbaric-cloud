import {ActionResolver, Actor, Job, JobPersistence, PropertyDefinition, Queue, State} from "anbaric-tsapi";
import {JobPersistenceFactory} from "./persistence/JobPersistenceFactory";
import {DefaultActionResolver} from "./actions/DefaultActionResolver";
import {InMemoryQueue} from "./scheduling/InMemoryQueue";
import {QueuePoller} from "./scheduling/QueuePoller";

class StateMachine {
    
    private states: Map<string, State>;
    private startState: string;
    private dataSchema: Map<string, PropertyDefinition>;
    private actionResolver: ActionResolver;
    private persistence: JobPersistence;
    private enque: (jobId: string) => void;

    constructor(states : Array<State>, startState : string, dataSchema : Array<PropertyDefinition>, actionResolver : ActionResolver = new DefaultActionResolver(), persistence : JobPersistence = JobPersistenceFactory.instance(), queue : Queue = new InMemoryQueue()) {

        this.states = new Map(states.map(state => [state.id, state]));
        this.startState = startState;
        this.dataSchema = new Map(dataSchema.map(property => [property.id, property]));
        this.actionResolver = actionResolver;
        this.persistence = persistence;

        new QueuePoller(queue, this);
        this.enque = queue.enqueue.bind(queue);
    }

    startJob(properties?: Map<string, any>, actor? : Actor): Job {

        const job = new Job(crypto.randomUUID(), properties, this.startState);

        this.validateProperties(properties ?? new Map(), true);
        this.authorizeActor(actor, job);

        this.persistence.save(job);

        this.enque(job.id);

        return job;
    }

    updateJob(jobId : string, properties : Map<string, any>, actor? : Actor) : void {
        this.authorizeActor(actor, this.persistence.retrieve(jobId));
        this.validateProperties(properties, false);
        this.persistence.updateProperties(jobId, properties);

        this.enque(jobId);
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

    progressJob(jobId : string) {
        const job = this.persistence.retrieve(jobId);
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

        this.persistence.save(mutableJob);
    }

    private authorizeActor(actor: Actor | undefined, job: Job) {
        if (job.id == "notyetimplemented") throw new Error("Not authorized");

        return;
    }
}

export { StateMachine }