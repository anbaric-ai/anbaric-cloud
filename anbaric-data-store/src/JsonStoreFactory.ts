import {JsonSchema, JsonStore, NoOpAuditor} from "anbaric-tsapi";
import {CloudAuditor, CloudJsonStore} from "anbaric-impl-cloud";
import {InMemoryJsonStore} from "./InMemoryJsonStore";

const JsonStoreFactory = {
    instance(collection : string, schema? : JsonSchema) : JsonStore {
        switch (process.env.ANBARIC_JSON_STORE_TYPE) {
            case "cloud":
                return new CloudJsonStore(collection, schema, undefined, new CloudAuditor());
            case "memory":
            default:
                return new InMemoryJsonStore(new NoOpAuditor(), schema, collection);
        }
    }
}

export { JsonStoreFactory };
