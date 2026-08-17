import {SecretStore} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudSecretStore implements SecretStore {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async save(name : string, value : string) : Promise<void> {
        await this.client.request("PUT", this.secretPath(name), { value });
    }

    async retrieve(name : string) : Promise<string> {
        const secret = await this.client.request("GET", this.secretPath(name)) as { value : string };
        return secret.value;
    }

    async delete(name : string) : Promise<void> {
        await this.client.request("DELETE", this.secretPath(name));
    }

    async list() : Promise<Array<string>> {
        return this.client.request("GET", "/secrets");
    }

    private secretPath(name : string) : string {
        return `/secrets/${encodeURIComponent(name)}`;
    }

}

export { CloudSecretStore }
