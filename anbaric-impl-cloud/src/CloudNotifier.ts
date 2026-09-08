import {Job, Notifier, WaitForInput, serializeJob, serializeWaitForInput} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient.js";

/* The app-side notifier. It carries no idea of how anyone is reached - it hands
   the targets and the parked job to the platform, which owns the delivery
   (email, in the hosted case). This is why an app never references a concrete
   notifier: it posts, exactly as CloudQueue and CloudJobPersistence do. */
class CloudNotifier implements Notifier {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async notify(targets : Array<string>, job : Job, waitingFor : WaitForInput) : Promise<void> {
        await this.client.request("POST", "/notifications", {
            targets,
            job: serializeJob(job),
            waitingFor: serializeWaitForInput(waitingFor),
        });
    }

}

export { CloudNotifier }
