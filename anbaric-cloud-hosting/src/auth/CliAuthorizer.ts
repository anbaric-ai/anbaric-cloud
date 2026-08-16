import {generateKeyPairSync, randomUUID} from "node:crypto";
import {CliKey} from "./CliKey";
import {CliKeyStore} from "./CliKeyStore";
import {User} from "./User";

type IssuedKeyPair = {
    keyId : string,
    clientName : string,
    publicKey : string,
    privateKey : string,
    tenant? : string,
};

class CliAuthorizer {

    private issued = new Map<string, IssuedKeyPair>();

    constructor(private keyStore : CliKeyStore) {}

    async approve(requestId : string, clientName : string, user : User, tenant? : string) : Promise<void> {
        const { publicKey, privateKey } = generateKeyPairSync("ed25519");
        const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
        const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

        const key = new CliKey(randomUUID(), user.id, clientName, publicKeyPem, tenant);
        await this.keyStore.save(key);

        this.issued.set(requestId, {
            keyId: key.id,
            clientName,
            publicKey: publicKeyPem,
            privateKey: privateKeyPem,
            tenant,
        });
    }

    collect(requestId : string) : IssuedKeyPair | undefined {
        const keyPair = this.issued.get(requestId);
        this.issued.delete(requestId);
        return keyPair;
    }

    keysFor(userId : string) : Promise<Array<CliKey>> {
        return this.keyStore.listFor(userId);
    }

    revoke(id : string, userId : string) : Promise<void> {
        return this.keyStore.delete(id, userId);
    }

}

export { CliAuthorizer };
export type { IssuedKeyPair };
