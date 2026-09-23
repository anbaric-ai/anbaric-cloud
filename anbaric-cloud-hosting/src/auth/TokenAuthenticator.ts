import {createPublicKey, verify} from "node:crypto";
import {IncomingMessage, ServerResponse} from "node:http";
import {CliKeyStore} from "./CliKeyStore";
import {User} from "./User";

const BEARER_PREFIX = "Bearer ";

class TokenAuthenticator {

    constructor(private keyStore : CliKeyStore, private tenant? : string) {}

    handles(request : IncomingMessage) : boolean {
        return String(request.headers.authorization ?? "").startsWith(BEARER_PREFIX);
    }

    async authenticate(request : IncomingMessage, response : ServerResponse) : Promise<User | undefined> {
        const token = String(request.headers.authorization).slice(BEARER_PREFIX.length);
        const user = await this.verifiedUser(token);
        if (!user) {
            response.writeHead(401, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "Invalid or expired token - run `anbaric login` to authorize this terminal" }));
        }
        return user;
    }

    private async verifiedUser(token : string) : Promise<User | undefined> {
        const [headerPart, payloadPart, signaturePart] = token.split(".");
        if (!headerPart || !payloadPart || !signaturePart) return undefined;

        const header = this.decoded(headerPart);
        const payload = this.decoded(payloadPart);
        if (header?.alg !== "EdDSA" || typeof header?.kid !== "string") return undefined;
        if (typeof payload?.exp !== "number" || payload.exp * 1000 < Date.now()) return undefined;

        const key = await this.keyStore.find(header.kid);
        if (!key) return undefined;
        if (this.tenant && key.tenant && key.tenant !== this.tenant) return undefined;
        if (!this.signatureValid(headerPart, payloadPart, signaturePart, key.publicKey)) return undefined;

        return new User(key.userId, [], [], undefined, undefined, undefined, key.tenantRole);
    }

    private signatureValid(headerPart : string, payloadPart : string, signaturePart : string,
                           publicKeyPem : string) : boolean {
        try {
            return verify(null, Buffer.from(`${headerPart}.${payloadPart}`),
                createPublicKey(publicKeyPem), Buffer.from(signaturePart, "base64url"));
        } catch {
            return false;
        }
    }

    private decoded(part : string) : any {
        try {
            return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
        } catch {
            return undefined;
        }
    }

}

export { TokenAuthenticator }
