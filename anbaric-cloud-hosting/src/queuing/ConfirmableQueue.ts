import {Dequeue, QueueMessage} from "anbaric-tsapi";

interface ConfirmableQueue extends Dequeue {

    confirm(message : QueueMessage) : Promise<void>;
    size() : Promise<number>;

}

export { ConfirmableQueue }
