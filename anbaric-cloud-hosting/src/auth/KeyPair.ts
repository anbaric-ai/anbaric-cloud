class KeyPair {

    readonly id : string;
    readonly publicKey : string;

    constructor(id : string, publicKey : string) {
        this.id = id;
        this.publicKey = publicKey;
    }

}

export { KeyPair }
