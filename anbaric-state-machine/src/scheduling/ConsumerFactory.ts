import {Consumer, Dequeue, Queue} from "anbaric-tsapi";
import {PushConsumer} from "anbaric-impl-cloud";
import {PullConsumer} from "./PullConsumer.js";

const ConsumerFactory = {
    instance(queue : Queue) : Consumer {
        if (Dequeue.supports(queue)) {
            return new PullConsumer(queue);
        } else {
            return new PushConsumer();
        }
    }
}

export { ConsumerFactory };
