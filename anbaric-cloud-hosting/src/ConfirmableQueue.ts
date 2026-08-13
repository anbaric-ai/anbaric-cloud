import {Queue, QueueMessage} from "anbaric-tsapi";

interface ConfirmableQueue extends Queue {

    confirm(message : QueueMessage) : Promise<void>;

}

export { ConfirmableQueue }
