import {JsonSchema, JsonStore, validateDocument} from "anbaric-tsapi";

class InMemoryJsonStore implements JsonStore {

    private documents = new Map<string, any>();

    constructor(private schema? : JsonSchema) {}

    async save(id : string, document : any) : Promise<void> {
        if (this.schema) {
            const violations = validateDocument(document, this.schema);
            if (violations.length > 0) {
                throw new Error(`Document "${id}" failed schema validation: ${violations.join("; ")}`);
            }
        }
        this.documents.set(id, document);
    }

    async retrieve(id : string) : Promise<any> {
        if (!this.documents.has(id)) {
            throw new Error(`No document found with id "${id}"`);
        }
        return this.documents.get(id);
    }

    async delete(id : string) : Promise<void> {
        this.documents.delete(id);
    }

    async list(pageSize : number = 100, page : number = 0) : Promise<Array<any>> {
        return Array.from(this.documents.values()).slice(page * pageSize, (page + 1) * pageSize);
    }

}

export { InMemoryJsonStore }
