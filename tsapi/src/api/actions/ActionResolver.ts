import {Job} from "../jobs/Job";
import {Action} from "./Action";

interface ActionResolver {

    resolve(candidates: Array<Action>, subject: Job) : Array<Action>;
}

export { ActionResolver }