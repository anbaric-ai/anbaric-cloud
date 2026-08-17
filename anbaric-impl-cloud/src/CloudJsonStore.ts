import {JsonSchema, JsonStore, validateDocument} from "anbaric-tsapi";
import {CloudApiClient} from "./CloudApiClient";

class CloudJsonStore implements JsonStore {

    private client : CloudApiClient;

    constructor(private collection : string, private schema? : JsonSchema,
                baseUrl : string = CloudApiClient.defaultBaseUrl()) {
        this.client = new CloudApiClient(baseUrl);
    }

    async save(id : string, document : any) : Promise<void> {
        if (this.schema) {
            const violations = validateDocument(document, this.schema);
            if (violations.length > 0) {
                throw new Error(`Document "${id}" failed schema validation: ${violations.join("; ")}`);
            }
        }
        await this.client.request("PUT", this.documentPath(id), document);
    }

    async retrieve(id : string) : Promise<any> {
        return this.client.request("GET", this.documentPath(id));
    }

    async delete(id : string) : Promise<void> {
        await this.client.request("DELETE", this.documentPath(id));
    }

    async list(pageSize : number = 100, page : number = 0) : Promise<Array<any>> {
        return this.client.request("GET", `/documents/${encodeURIComponent(this.collection)}?pageSize=${pageSize}&page=${page}`);
    }

    private documentPath(id : string) : string {
        return `/documents/${encodeURIComponent(this.collection)}/${encodeURIComponent(id)}`;
    }

}

export { CloudJsonStore }
