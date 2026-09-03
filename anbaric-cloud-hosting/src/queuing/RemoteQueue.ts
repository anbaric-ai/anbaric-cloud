import {Dequeue, QueueMessage} from "anbaric-tsapi";

interface RemoteQueue extends Dequeue {

    confirm(message : QueueMessage) : Promise<void>;
    // Push a message that could not be delivered yet (e.g. its consumer has not
    // registered) into the future with a growing back-off, so a momentary race
    // resolves itself. After enough bounces the message is cancelled.
    debounce(message : QueueMessage) : Promise<void>;
    // Discard a message that can never be delivered. Removes it like confirm,
    // but signals an error.
    cancel(message : QueueMessage) : Promise<void>;
    size() : Promise<number>;

}

export { RemoteQueue }
