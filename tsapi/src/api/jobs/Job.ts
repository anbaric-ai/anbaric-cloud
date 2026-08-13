import {Transition} from "../transitions/Transition";

class Job {

    readonly id : string;
    private state: string;
    properties : Map<string, any>;

    constructor(id : string, properties : Map<string, any> = new Map(), initialState: string) {
        this.id = id;
        this.properties = properties;
        this.state = initialState;
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
