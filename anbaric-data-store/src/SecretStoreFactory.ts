import {SecretStore} from "anbaric-tsapi";
import {CloudSecretStore} from "anbaric-impl-cloud";
import {InMemorySecretStore} from "./InMemorySecretStore";

const SecretStoreFactory = {
    instance() : SecretStore {
        switch (process.env.ANBARIC_SECRET_STORE_TYPE) {
            case "cloud":
                return new CloudSecretStore();
            case "memory":
            default:
                return new InMemorySecretStore();
        }
    }
}

export { SecretStoreFactory };
