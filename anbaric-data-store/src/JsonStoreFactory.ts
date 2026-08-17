import {JsonSchema, JsonStore} from "anbaric-tsapi";
import {CloudJsonStore} from "anbaric-impl-cloud";
import {InMemoryJsonStore} from "./InMemoryJsonStore";

const JsonStoreFactory = {
    instance(collection : string, schema? : JsonSchema) : JsonStore {
        switch (process.env.ANBARIC_JSON_STORE_TYPE) {
            case "cloud":
                return new CloudJsonStore(collection, schema);
            case "memory":
            default:
                return new InMemoryJsonStore(schema);
        }
    }
}

export { JsonStoreFactory };
