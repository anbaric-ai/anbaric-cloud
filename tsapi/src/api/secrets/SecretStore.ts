import {Actor} from "../actors/Actor";
import {Auditor} from "../auditing/Auditor";
import {currentAppId} from "../cloud/AppAware";

/* Stores named secrets and audits every interaction. The secret value is
   never included in an audit record. Public methods audit then defer to the
   abstract ...Internal methods. */
abstract class SecretStore {

    constructor(protected auditor : Auditor) {
    }

    async create(actor : Actor, name : string, value : string) : Promise<void> {
        await this.auditor.audit(currentAppId(), "secret", name, actor, [SecretStore.Interaction.CREATE], "Secret created", null);
        await this.saveInternal(name, value);
    }

    async save(actor : Actor, changeDescription : string, name : string, value : string) : Promise<void> {
        await this.auditor.audit(currentAppId(), "secret", name, actor, [SecretStore.Interaction.SAVE], changeDescription, null);
        await this.saveInternal(name, value);
    }

    async retrieve(name : string, actor : Actor) : Promise<string> {
        await this.auditor.audit(currentAppId(), "secret", name, actor, [SecretStore.Interaction.READ], "", null);
        return this.retrieveInternal(name);
    }

    async delete(name : string, actor : Actor) : Promise<void> {
        await this.auditor.audit(currentAppId(), "secret", name, actor, [SecretStore.Interaction.DELETE], "", null);
        await this.deleteInternal(name);
    }

    async list(actor : Actor) : Promise<Array<string>> {
        await this.auditor.audit(currentAppId(), "secret", "*", actor, [SecretStore.Interaction.LIST], "", null);
        return this.listInternal();
    }

    protected abstract saveInternal(name : string, value : string) : Promise<void>;
    protected abstract retrieveInternal(name : string) : Promise<string>;
    protected abstract deleteInternal(name : string) : Promise<void>;
    protected abstract listInternal() : Promise<Array<string>>;

}

namespace SecretStore {

    export enum Interaction {
        CREATE = "CREATE",
        SAVE = "SAVE",
        READ = "READ",
        DELETE = "DELETE",
        LIST = "LIST",
    }

}

export { SecretStore }
