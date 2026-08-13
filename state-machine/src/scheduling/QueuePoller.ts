import {Queue} from "anbaric-tsapi";
import {StateMachine} from "../StateMachine";

class QueuePoller {

    constructor(private queue : Queue, private stateMachine : StateMachine) {}

    private async poll() : Promise<void> {
        const jobs = await this.queue.dequeueSome();
        for (const jobId of jobs) {
            await this.stateMachine.progressJob(jobId);
        }
    }
}

export { QueuePoller }
