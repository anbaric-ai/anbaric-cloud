import {CliKey} from "./CliKey";

interface CliKeyStore {

    save(key : CliKey) : Promise<void>;
    find(id : string) : Promise<CliKey | undefined>;
    listFor(userId : string) : Promise<Array<CliKey>>;
    delete(id : string, userId : string) : Promise<void>;

}

export { CliKeyStore }
