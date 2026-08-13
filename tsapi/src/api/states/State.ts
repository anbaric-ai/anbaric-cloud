import {Action} from "../actions/Action";

class State {

    readonly id : string;
    actions : Array<Action>;

    constructor(id : string, actions : Array<Action> = []) {
        this.id = id;
        this.actions = actions;
    }
}

export { State }