import {Auditor, JsonSchema, JsonStore, NoOpAuditor, validateDocument} from "anbaric-tsapi";

class InMemoryJsonStore extends JsonStore {

    private documents = new Map<string, any>();
    private schema? : JsonSchema;

    constructor(auditor : Auditor = new NoOpAuditor(), schema? : JsonSchema, collection : string = "documents") {
        super(auditor, collection);
        this.schema = schema;
    }

    protected async saveInternal(id : string, document : any) : Promise<void> {
        if (this.schema) {
            const violations = validateDocument(document, this.schema);
            if (violations.length > 0) {
                throw new Error(`Document "${id}" failed schema validation: ${violations.join("; ")}`);
            }
        }
        this.documents.set(id, document);
    }

    protected async retrieveInternal(id : string) : Promise<any> {
        if (!this.documents.has(id)) {
            throw new Error(`No document found with id "${id}"`);
        }
        return this.documents.get(id);
    }

    protected async deleteInternal(id : string) : Promise<void> {
        this.documents.delete(id);
    }

    protected async listInternal(pageSize : number = 100, page : number = 0) : Promise<Array<any>> {
        return Array.from(this.documents.values()).slice(page * pageSize, (page + 1) * pageSize);
    }

}

export { InMemoryJsonStore }
