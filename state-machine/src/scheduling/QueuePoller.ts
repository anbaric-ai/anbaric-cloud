import {Queue} from "anbaric-tsapi";
import {StateMachine} from "../StateMachine";

class QueuePoller {

    constructor(private queue : Queue, private stateMachine : StateMachine) {}

    private poll() {
        const jobs = this.queue.dequeueSome();
        jobs.forEach(jobId => this.stateMachine.progressJob(jobId));
    }
}

export { QueuePoller }