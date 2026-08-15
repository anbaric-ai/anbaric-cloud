import {randomUUID} from "node:crypto";
import {StoredKey} from "./CliConfig";

const POLL_INTERVAL_MS = 1000;
const HANDSHAKE_TIMEOUT_MS = 300_000;

class KeyRequest {

    constructor(private platformUrl : string,
                private requestId : string = randomUUID(),
                private pollIntervalMs : number = POLL_INTERVAL_MS,
                private timeoutMs : number = HANDSHAKE_TIMEOUT_MS) {}

    get authorizeUrl() : string {
        return `${this.platformUrl}/authorize-cli/${this.requestId}`;
    }

    async awaitKey() : Promise<StoredKey> {
        const deadline = Date.now() + this.timeoutMs;

        while (Date.now() < deadline) {
            const response = await fetch(`${this.authorizeUrl}/poll`);
            if (response.status === 200) {
                const issued = await response.json();
                return {
                    platformUrl: this.platformUrl,
                    keyId: issued.keyId,
                    clientName: issued.clientName,
                    publicKey: issued.publicKey,
                    privateKey: issued.privateKey,
                    tenant: issued.tenant,
                };
            }
            await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
        }

        throw new Error("Timed out waiting for the browser authorization - run `anbaric login` to try again");
    }

}

export { KeyRequest }
