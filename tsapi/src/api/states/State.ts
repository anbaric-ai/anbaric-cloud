import {Action} from "../actions/Action.js";
import {Await} from "../actions/Await.js";
import {Transition} from "../transitions/Transition.js";

class State {

    readonly id : string;
    actions : Array<Action | Await>;
    transitions : Array<Transition>;
    readonly isTerminal : boolean;

    constructor(id : string, actions : Array<Action | Await> = [], transitions : Array<Transition> = [], isTerminal : boolean = false) {
        this.id = id;
        this.actions = actions;
        this.transitions = transitions;
        this.isTerminal = isTerminal;
    }

    subscribe(action : Action | Await) : void {
        this.actions.push(action);
    }

}

export { State }