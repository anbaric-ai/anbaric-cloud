class CliKey {

    readonly id : string;
    readonly userId : string;
    readonly clientName : string;
    readonly publicKey : string;
    readonly tenant? : string;
    readonly createdAt : Date;

    constructor(id : string, userId : string, clientName : string, publicKey : string,
                tenant? : string, createdAt : Date = new Date()) {
        this.id = id;
        this.userId = userId;
        this.clientName = clientName;
        this.publicKey = publicKey;
        this.tenant = tenant;
        this.createdAt = createdAt;
    }

}

export { CliKey }
