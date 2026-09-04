import {AppAware, Auditor, currentAppId, JsonSchema, JsonStore, NoOpAuditor, validateDocument} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient.js";

class CloudJsonStore extends JsonStore implements AppAware {

    private client : CloudApiClient;
    private schema? : JsonSchema;

    constructor(collection : string, schema? : JsonSchema,
                baseUrl : string = CloudApiClient.defaultBaseUrl(), auditor : Auditor = new NoOpAuditor()) {
        super(auditor, collection);
        this.schema = schema;
        this.client = new CloudApiClient(baseUrl);
    }

    getAppId() : string {
        return currentAppId();
    }

    protected async saveInternal(id : string, document : any) : Promise<void> {
        if (this.schema) {
            const violations = validateDocument(document, this.schema);
            if (violations.length > 0) {
                throw new Error(`Document "${id}" failed schema validation: ${violations.join("; ")}`);
            }
        }
        await this.client.request("PUT", this.documentPath(id), document);
    }

    protected async retrieveInternal(id : string) : Promise<any> {
        return this.client.request("GET", this.documentPath(id));
    }

    protected async deleteInternal(id : string) : Promise<void> {
        await this.client.request("DELETE", this.documentPath(id));
    }

    protected async listInternal(pageSize : number = 100, page : number = 0) : Promise<Array<any>> {
        return this.client.request("GET", `/documents/${encodeURIComponent(this.collection)}?pageSize=${pageSize}&page=${page}`);
    }

    private documentPath(id : string) : string {
        return `/documents/${encodeURIComponent(this.collection)}/${encodeURIComponent(id)}`;
    }

}

export { CloudJsonStore }
