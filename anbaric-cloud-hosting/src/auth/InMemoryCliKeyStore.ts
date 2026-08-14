import {CliKey} from "./CliKey";
import {CliKeyStore} from "./CliKeyStore";

class InMemoryCliKeyStore implements CliKeyStore {

    private keys = new Map<string, CliKey>();

    async save(key : CliKey) : Promise<void> {
        this.keys.set(key.id, key);
    }

    async find(id : string) : Promise<CliKey | undefined> {
        return this.keys.get(id);
    }

    async listFor(userId : string) : Promise<Array<CliKey>> {
        return Array.from(this.keys.values()).filter(key => key.userId === userId);
    }

    async delete(id : string, userId : string) : Promise<void> {
        const key = this.keys.get(id);
        if (key && key.userId === userId) this.keys.delete(id);
    }

}

export { InMemoryCliKeyStore }
