import {AppAddress, Subdomains} from "./Subdomains";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

/* Asks the control plane for this tenant's app addresses, with the same
   central api key the platform already holds for key lookups and memberships.

   Allocation is idempotent at the other end, so asking twice for one app is
   not a mistake - it is how the platform makes sure every app it is running
   has an address, every time it boots. A failure to allocate is reported as
   nothing rather than thrown: an app that is running and reachable by path
   should not be held up because its address could not be arranged, and the
   next boot will ask again. Setting one, which a person did on purpose and is
   waiting on, does throw. */
const LIST_CACHE_TTL_MS = 60_000;

class HttpSubdomains implements Subdomains {

    private listed? : { addresses : Array<AppAddress>, expires : number };

    constructor(private centralUrl : string, private secret : string, private tenantSlug : string,
                private fetchFn : FetchFn = (url, init) => fetch(url, init),
                private cacheTtlMs : number = LIST_CACHE_TTL_MS) {}

    async allocate(appName : string) : Promise<AppAddress | undefined> {
        try {
            const response = await this.call("POST", `/${encodeURIComponent(appName)}/subdomain`);
            this.listed = undefined;
            return await response.json() as AppAddress;
        } catch (error) {
            console.warn(`[subdomains] could not get an address for "${appName}": ${this.because(error)}`);
            return undefined;
        }
    }

    async set(appName : string, subdomain : string) : Promise<AppAddress> {
        const response = await this.call("PUT", `/${encodeURIComponent(appName)}/subdomain`, { subdomain });
        this.listed = undefined;
        return await response.json() as AppAddress;
    }

    async release(appName : string) : Promise<void> {
        try {
            await this.call("DELETE", `/${encodeURIComponent(appName)}/subdomain`, undefined, [404]);
        } catch (error) {
            console.warn(`[subdomains] could not release the address for "${appName}": ${this.because(error)}`);
        }
        this.listed = undefined;
    }

    /* The console asks for the app list on every page load, and an address
       only changes when this platform changes it - so the answer is held until
       it does, or until a minute has passed and another platform of the same
       tenant might have. */
    async all() : Promise<Array<AppAddress>> {
        if (this.listed && this.listed.expires > Date.now()) return this.listed.addresses;

        try {
            const response = await this.call("GET", "");
            const addresses = await response.json() as Array<AppAddress>;
            this.listed = { addresses, expires: Date.now() + this.cacheTtlMs };
            return addresses;
        } catch (error) {
            console.warn(`[subdomains] could not list app addresses: ${this.because(error)}`);
            return this.listed?.addresses ?? [];
        }
    }

    private because(error : unknown) : string {
        return error instanceof Error ? error.message : String(error);
    }

    private async call(method : string, path : string, body? : unknown,
                       tolerated : Array<number> = []) : Promise<Response> {
        const headers : Record<string, string> = { "x-anbaric-central-key": this.secret };
        if (body !== undefined) headers["content-type"] = "application/json";

        const response = await this.fetchFn(
            `${this.centralUrl.replace(/\/$/, "")}/tenants/${encodeURIComponent(this.tenantSlug)}/apps${path}`,
            { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

        if (! response.ok && ! tolerated.includes(response.status)) {
            const problem = await response.json().catch(() => ({})) as { error? : string };
            throw new Error(problem.error ?? `The request to the central login failed with status ${response.status}`);
        }
        return response;
    }

}

export { HttpSubdomains };
