import {Action, ActionResolver, Job} from "anbaric-tsapi";

class DefaultActionResolver implements ActionResolver {

    resolve(candidates: Array<Action>, subject: Job): Array<Action> {
        return candidates.filter(candidate => candidate.predicate(subject));
    }

}

export { DefaultActionResolver }