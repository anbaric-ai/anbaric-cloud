import {NoOpAuditor, SecretStore} from "anbaric-tsapi";
import {CloudAuditor, CloudSecretStore} from "anbaric-impl-cloud";
import {InMemorySecretStore} from "./InMemorySecretStore";

const SecretStoreFactory = {
    instance() : SecretStore {
        switch (process.env.ANBARIC_SECRET_STORE_TYPE) {
            case "cloud":
                return new CloudSecretStore(undefined, new CloudAuditor());
            case "memory":
            default:
                return new InMemorySecretStore(undefined, new NoOpAuditor());
        }
    }
}

export { SecretStoreFactory };
