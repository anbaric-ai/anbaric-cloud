import {Job} from "../jobs/Job";

class Action {

    predicate = (job : Job) => true;
    run = (job : Job) => job;

}

export { Action }