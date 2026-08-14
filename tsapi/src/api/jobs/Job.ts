import {Transition} from "../transitions/Transition";

class Job {

    readonly id : string;
    private state: string;
    properties : Map<string, any>;
    readonly workflowId? : string;

    constructor(id : string, properties : Map<string, any> = new Map(), initialState: string, workflowId? : string) {
        this.id = id;
        this.properties = properties;
        this.state = initialState;
        this.workflowId = workflowId;
    }

    private setState(stateId : string) : void {
        this.state = stateId;
    }

    get stateId() : string | undefined {
        return this.state;
    }

    transition(transition : Transition) : boolean {

        if (transition.predicate(this)) {
            this.setState(transition.to);
            return true;
        }

        return false;
    }

}

export { Job }
