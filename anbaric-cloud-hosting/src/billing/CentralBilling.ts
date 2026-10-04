type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

/* What this tenant is spending and where its owner pays. The numbers are the
   control plane's - it holds the metering, the prices and the allowance - so
   the platform asks and passes the answer on without interpreting it, the
   same way it asks about memberships. */
class CentralBilling {

    constructor(private centralUrl : string, private secret : string, private tenantSlug : string,
                private fetchFn : FetchFn = (url, init) => fetch(url, init)) {}

    async summary() : Promise<Record<string, unknown>> {
        const response = await this.call("GET", `/usage/${encodeURIComponent(this.tenantSlug)}`);
        return await response.json() as Record<string, unknown>;
    }

    async portalUrl(returnUrl : string) : Promise<string> {
        const response = await this.call("POST", `/tenants/${encodeURIComponent(this.tenantSlug)}/billing/portal`, { returnUrl });
        return String((await response.json() as { url : string }).url);
    }

    /* Ends the tenant, on the say-so of the person named, whom central checks
       is its owner. Nothing here is undone afterwards; this platform is among
       the things going. */
    async terminate(userId : string) : Promise<void> {
        await this.call("DELETE", `/tenants/${encodeURIComponent(this.tenantSlug)}`, undefined, { "x-anbaric-user": userId });
    }

    private async call(method : string, path : string, body? : unknown, extra : Record<string, string> = {}) : Promise<Response> {
        const headers : Record<string, string> = { "x-anbaric-central-key": this.secret, ...extra };
        if (body !== undefined) headers["content-type"] = "application/json";

        const response = await this.fetchFn(`${this.centralUrl.replace(/\/$/, "")}${path}`,
            { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

        if (! response.ok) {
            const problem = await response.json().catch(() => ({})) as { error? : string };
            throw new Error(problem.error ?? `The request to the central login failed with status ${response.status}`);
        }
        return response;
    }

}

export { CentralBilling };
