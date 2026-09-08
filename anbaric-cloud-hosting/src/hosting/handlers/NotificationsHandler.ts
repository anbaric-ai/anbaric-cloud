import {Notifier, deserializeJob, deserializeWaitForInput} from "anbaric-tsapi";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* Receives a deployed app's notification request and hands it to the platform's
   server-side notifier. Delivery is the notifier's business - the platform just
   reconstructs the job and its wait from the wire and passes them on. */
class NotificationsHandler implements RequestHandler {

    constructor(private notifier : Notifier) {}

    async handle(request : Request) : Promise<void> {
        if (request.method !== "POST" || request.id) return request.notFound();

        const { targets, job, waitingFor } = await request.body();
        if (!Array.isArray(targets) || !job || !waitingFor) {
            return request.reply(400, { error: "Expected { targets, job, waitingFor }" });
        }

        await this.notifier.notify(targets, deserializeJob(job), deserializeWaitForInput(waitingFor));
        request.reply(204);
    }

}

export { NotificationsHandler }
