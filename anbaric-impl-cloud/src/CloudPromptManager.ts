import {AppAware, currentAppId, JsonSchema, Prompt, PromptManager} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient.js";

/* Prompts are owned by the calling app - the ambient app header the client
   always sends - so no app id appears in any path. */
class CloudPromptManager implements PromptManager, AppAware {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    getAppId() : string {
        return currentAppId();
    }

    async save(promptId : string, instructions : string, outputSchema? : JsonSchema) : Promise<Prompt> {
        return this.client.request("PUT", this.promptPath(promptId), { instructions, outputSchema });
    }

    async retrieve(promptId : string, version? : number) : Promise<Prompt> {
        const query = version === undefined ? "" : `?version=${encodeURIComponent(version)}`;
        return this.client.request("GET", `${this.promptPath(promptId)}${query}`);
    }

    async list() : Promise<Array<Prompt>> {
        return this.client.request("GET", "/prompts");
    }

    async history(promptId : string) : Promise<Array<Prompt>> {
        return this.client.request("GET", `${this.promptPath(promptId)}/history`);
    }

    private promptPath(promptId : string) : string {
        return `/prompts/${encodeURIComponent(promptId)}`;
    }

}

export { CloudPromptManager }
