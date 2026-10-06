import {createCipheriv, createDecipheriv, randomBytes} from "node:crypto";
import {Auditor, NoOpAuditor, SecretStore} from "anbaric-tsapi";

type EncryptedSecret = {
    iv : Buffer,
    cipherText : Buffer,
    authTag : Buffer,
};

type Environment = Record<string, string | undefined>;

// The environment variable a secret name falls back to: "openai-key" reads
// OPENAI_KEY, "stripe.secret" reads STRIPE_SECRET.
const environmentNameFor = (name : string) : string =>
    name.toUpperCase().replace(/[^A-Z0-9]/g, "_");

/* The secret store an app gets with no platform behind it. Anything written is
   held encrypted in memory for the life of the process; anything asked for and
   never written is looked for in the environment, under the name upper-cased.
   That is the local backstop: an app that reads its model key from the store
   runs on a laptop with the key in a shell variable and on the platform with
   the key in the real store, from the same line of code. Deployed stores have
   no such fallback - a missing secret there is a missing secret. */
class InMemorySecretStore extends SecretStore {

    private secrets = new Map<string, EncryptedSecret>();
    private encryptionKey : Buffer;

    constructor(encryptionKey : Buffer = randomBytes(32), auditor : Auditor = new NoOpAuditor(),
                private environment : Environment = process.env) {
        super(auditor);
        this.encryptionKey = encryptionKey;
    }

    protected async saveInternal(name : string, value : string) : Promise<void> {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
        const cipherText = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
        this.secrets.set(name, { iv, cipherText, authTag: cipher.getAuthTag() });
    }

    protected async retrieveInternal(name : string) : Promise<string> {
        const secret = this.secrets.get(name);
        if (!secret) {
            const fromEnvironment = this.environment[environmentNameFor(name)];
            if (fromEnvironment !== undefined) return fromEnvironment;
            throw new Error(`No secret found with name "${name}"`);
        }
        const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, secret.iv);
        decipher.setAuthTag(secret.authTag);
        return Buffer.concat([decipher.update(secret.cipherText), decipher.final()]).toString("utf8");
    }

    protected async deleteInternal(name : string) : Promise<void> {
        this.secrets.delete(name);
    }

    protected async listInternal() : Promise<Array<string>> {
        return Array.from(this.secrets.keys());
    }

}

export { InMemorySecretStore, environmentNameFor }
