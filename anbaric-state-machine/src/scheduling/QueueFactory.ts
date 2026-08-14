import {Queue} from "anbaric-tsapi";
import {CloudQueue} from "anbaric-cloud";
import {InMemoryQueue} from "./InMemoryQueue";

const QueueFactory = {
    instance() : Queue {
        switch (process.env.ANBARIC_QUEUE_TYPE) {
            case "cloud":
                return new CloudQueue();
            case "memory":
            default:
                return new InMemoryQueue();
        }
    }
}

export { QueueFactory };
