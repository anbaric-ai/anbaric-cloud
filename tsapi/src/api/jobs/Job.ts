import {Transition} from "../transitions/Transition";
import {JobTransition} from "./JobTransition";

class Job {

    readonly id : string;
    private state: string;
    properties : Map<string, any>;
    readonly workflowId? : string;
    readonly startedAt : Date;
    readonly startedBy : string;
    lastUpdated : Date;
    readonly transitions : Array<JobTransition>;

    constructor(id : string, properties : Map<string, any> = new Map(), initialState: string, workflowId? : string,
                startedBy : string = "system", startedAt : Date = new Date(),
                lastUpdated : Date = startedAt, transitions : Array<JobTransition> = []) {
        this.id = id;
        this.properties = properties;
        this.state = initialState;
        this.workflowId = workflowId;
        this.startedBy = startedBy;
        this.startedAt = startedAt;
        this.lastUpdated = lastUpdated;
        this.transitions = transitions;
    }

    private setState(stateId : string) : void {
        this.state = stateId;
    }

    get stateId() : string | undefined {
        return this.state;
    }

    transition(transition : Transition, actor : string = this.workflowId ?? "state-machine") : boolean {

        if (transition.predicate(this)) {
            this.transitions.push({ from: this.state, to: transition.to, actor });
            this.setState(transition.to);
            this.lastUpdated = new Date();
            return true;
        }

        return false;
    }

}

export { Job }
