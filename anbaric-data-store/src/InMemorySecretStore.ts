import {createCipheriv, createDecipheriv, randomBytes} from "node:crypto";
import {SecretStore} from "anbaric-tsapi";

type EncryptedSecret = {
    iv : Buffer,
    cipherText : Buffer,
    authTag : Buffer,
};

class InMemorySecretStore implements SecretStore {

    private secrets = new Map<string, EncryptedSecret>();
    private encryptionKey : Buffer;

    constructor(encryptionKey : Buffer = randomBytes(32)) {
        this.encryptionKey = encryptionKey;
    }

    async save(name : string, value : string) : Promise<void> {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
        const cipherText = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
        this.secrets.set(name, { iv, cipherText, authTag: cipher.getAuthTag() });
    }

    async retrieve(name : string) : Promise<string> {
        const secret = this.secrets.get(name);
        if (!secret) {
            throw new Error(`No secret found with name "${name}"`);
        }
        const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, secret.iv);
        decipher.setAuthTag(secret.authTag);
        return Buffer.concat([decipher.update(secret.cipherText), decipher.final()]).toString("utf8");
    }

    async delete(name : string) : Promise<void> {
        this.secrets.delete(name);
    }

    async list() : Promise<Array<string>> {
        return Array.from(this.secrets.keys());
    }

}

export { InMemorySecretStore }
