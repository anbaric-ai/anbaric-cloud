import {Action} from "../actions/Action";
import {Transition} from "../transitions/Transition";

class State {

    readonly id : string;
    actions : Array<Action>;
    transitions : Array<Transition>;
    readonly isTerminal : boolean;

    constructor(id : string, actions : Array<Action> = [], transitions : Array<Transition> = [], isTerminal : boolean = false) {
        this.id = id;
        this.actions = actions;
        this.transitions = transitions;
        this.isTerminal = isTerminal;
    }

    subscribe(action : Action) : void {
        this.actions.push(action);
    }

}

export { State }