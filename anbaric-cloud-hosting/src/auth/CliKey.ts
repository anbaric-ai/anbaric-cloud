import {TenantRole} from "./TenantRole";

class CliKey {

    readonly id : string;
    readonly userId : string;
    readonly clientName : string;
    readonly publicKey : string;
    readonly tenant? : string;
    // The role the key's owner held in that tenant when it was issued; the
    // platform re-reads it on every lookup, so a demotion takes effect at once.
    readonly tenantRole? : TenantRole;
    readonly createdAt : Date;

    constructor(id : string, userId : string, clientName : string, publicKey : string,
                tenant? : string, createdAt : Date = new Date(), tenantRole? : TenantRole) {
        this.id = id;
        this.userId = userId;
        this.clientName = clientName;
        this.publicKey = publicKey;
        this.tenant = tenant;
        this.createdAt = createdAt;
        this.tenantRole = tenantRole;
    }

}

export { CliKey }
