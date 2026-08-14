interface SecretStore {

    save(name : string, value : string) : Promise<void>;
    retrieve(name : string) : Promise<string>;
    delete(name : string) : Promise<void>;
    list() : Promise<Array<string>>;

}

export { SecretStore }
