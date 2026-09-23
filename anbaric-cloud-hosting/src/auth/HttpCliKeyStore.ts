import {CliKey} from "./CliKey";
import {CliKeyStore} from "./CliKeyStore";
import {TenantRole} from "./TenantRole";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

const CACHE_TTL_MS = 60_000;

/* Looks CLI keys up from a central key registry over HTTP - used when a
   platform's keys are issued elsewhere (Anbaric Cloud's central login).
   Read-only: key issuance, listing and revocation live with the registry. */
class HttpCliKeyStore implements CliKeyStore {

    private cache = new Map<string, { key : CliKey | undefined, expires : number }>();

    constructor(private lookupUrl : string, private secret : string,
                private fetchFn : FetchFn = (url, init) => fetch(url, init),
                private cacheTtlMs : number = CACHE_TTL_MS) {}

    async find(id : string) : Promise<CliKey | undefined> {
        const cached = this.cache.get(id);
        if (cached && cached.expires > Date.now()) return cached.key;

        const key = await this.lookup(id);
        this.cache.set(id, { key, expires: Date.now() + this.cacheTtlMs });
        return key;
    }

    async save(_key : CliKey) : Promise<void> {
        throw new Error("Keys are issued by the central registry, not by this platform");
    }

    async listFor(_userId : string) : Promise<Array<CliKey>> {
        return [];
    }

    async delete(_id : string, _userId : string) : Promise<void> {
        throw new Error("Keys are revoked at the central registry, not by this platform");
    }

    private async lookup(id : string) : Promise<CliKey | undefined> {
        const response = await this.fetchFn(`${this.lookupUrl}/cli-keys/${encodeURIComponent(id)}`, {
            headers: { "x-anbaric-central-key": this.secret },
        });
        if (response.status === 404) return undefined;
        if (!response.ok) throw new Error(`The key lookup failed with status ${response.status}`);

        const found = await response.json() as
            { userId : string, clientName? : string, publicKey : string, tenant? : string, tenantRole? : TenantRole };
        return new CliKey(id, found.userId, found.clientName ?? "", found.publicKey, found.tenant ?? undefined,
            new Date(), found.tenantRole);
    }

}

export { HttpCliKeyStore }
