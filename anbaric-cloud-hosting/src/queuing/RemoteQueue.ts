import {Dequeue, QueueMessage} from "anbaric-tsapi";

interface RemoteQueue extends Dequeue {

    confirm(message : QueueMessage) : Promise<void>;
    // Discard a message that can never be delivered (e.g. nothing is registered
    // to listen for it). Removes it like confirm, but signals an error.
    cancel(message : QueueMessage) : Promise<void>;
    size() : Promise<number>;

}

export { RemoteQueue }
