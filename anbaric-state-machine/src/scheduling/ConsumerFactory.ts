import {Consumer, Dequeue, Queue} from "anbaric-tsapi";
import {PushConsumer} from "anbaric-impl-cloud";
import {PullConsumer} from "./PullConsumer.js";

/* Consumers are shared rather than made per state machine. A push consumer
   binds a port, so giving every machine its own meant the second machine in a
   deployed app died on EADDRINUSE - an app could only ever have one machine.
   Both consumers already key their subscribers by (appId, workflowId), so one
   shared consumer dispatches each message to the right machine.

   Neither is shared globally, because a consumer is only interchangeable with
   another that talks to the same place. Pull consumers are shared per queue: a
   machine built with its own queue still needs that queue drained, and
   QueueFactory hands out a separate in-memory queue on every call. Push
   consumers are shared per platform, since a consumer registers its callback
   URL with one platform and confirms messages back to it. A process talks to a
   single platform, so in a deployed app that is one consumer on one port. */

const pullConsumers = new WeakMap<Dequeue, PullConsumer>();

const pushConsumers = new Map<string, PushConsumer>();

const platform = () => process.env.ANBARIC_CLOUD_URL ?? "";

const ConsumerFactory = {

    instance(queue : Queue) : Consumer {
        if (Dequeue.supports(queue)) {
            const existing = pullConsumers.get(queue);
            if (existing) return existing;

            const consumer = new PullConsumer(queue);
            pullConsumers.set(queue, consumer);
            return consumer;
        }

        const platformUrl = platform();
        const existing = pushConsumers.get(platformUrl);
        if (existing) return existing;

        const consumer = new PushConsumer();
        pushConsumers.set(platformUrl, consumer);
        return consumer;
    },

}

export { ConsumerFactory };
