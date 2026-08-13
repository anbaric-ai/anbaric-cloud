import {Action} from "../actions/Action";
import {Transition} from "../transitions/Transition";

class State {

    readonly id : string;
    actions : Array<Action>;
    transitions : Array<Transition>;

    constructor(id : string, actions : Array<Action> = [], transitions : Array<Transition> = []) {
        this.id = id;
        this.actions = actions;
        this.transitions = transitions;
    }
}

export { State }