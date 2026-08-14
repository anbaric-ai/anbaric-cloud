import {Consumer, Dequeue, Queue} from "anbaric-tsapi";
import {PushConsumer} from "anbaric-cloud";
import {PullConsumer} from "./PullConsumer";

const ConsumerFactory = {
    instance(queue : Queue) : Consumer {
        if (Dequeue.supports(queue)) {
            return new PullConsumer(queue);
        }
        return new PushConsumer();
    }
}

export { ConsumerFactory };
