import {Consumer, Queue} from "anbaric-tsapi";
import {CloudConsumer} from "anbaric-cloud";
import {LocalConsumer} from "./LocalConsumer";

const ConsumerFactory = {
    instance(queue : Queue) : Consumer {
        switch (process.env.ANBARIC_CONSUMER_TYPE) {
            case "cloud":
                return new CloudConsumer();
            case "local":
            default:
                return new LocalConsumer(queue);
        }
    }
}

export { ConsumerFactory };
