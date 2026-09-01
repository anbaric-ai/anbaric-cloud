import {AppAware, Auditor, currentAppId, NoOpAuditor, SecretStore} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudSecretStore extends SecretStore implements AppAware {

    private client : CloudApiClient;

    constructor(baseUrl : string = CloudApiClient.defaultBaseUrl(), auditor : Auditor = new NoOpAuditor()) {
        super(auditor);
        this.client = new CloudApiClient(baseUrl);
    }

    getAppId() : string {
        return currentAppId();
    }

    protected async saveInternal(name : string, value : string) : Promise<void> {
        await this.client.request("PUT", this.secretPath(name), { value });
    }

    protected async retrieveInternal(name : string) : Promise<string> {
        const secret = await this.client.request("GET", this.secretPath(name)) as { value : string };
        return secret.value;
    }

    protected async deleteInternal(name : string) : Promise<void> {
        await this.client.request("DELETE", this.secretPath(name));
    }

    protected async listInternal() : Promise<Array<string>> {
        return this.client.request("GET", "/secrets");
    }

    private secretPath(name : string) : string {
        return `/secrets/${encodeURIComponent(name)}`;
    }

}

export { CloudSecretStore }
