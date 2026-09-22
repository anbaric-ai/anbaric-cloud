import {Inviter, MembershipService, PendingInvitation} from "./MembershipService";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

/* Talks to the central login's invitation endpoints for one tenant, with the
   same central api key the platform already holds for CLI key lookups. */
class HttpMembershipService implements MembershipService {

    constructor(private centralUrl : string, private secret : string, private tenantSlug : string,
                private fetchFn : FetchFn = (url, init) => fetch(url, init)) {}

    async invite(email : string, invitedBy : Inviter) : Promise<PendingInvitation> {
        const response = await this.call("POST", "", { email, invitedBy });
        return await response.json() as PendingInvitation;
    }

    async pending() : Promise<Array<PendingInvitation>> {
        const response = await this.call("GET", "");
        return await response.json() as Array<PendingInvitation>;
    }

    async revoke(token : string) : Promise<boolean> {
        const response = await this.call("DELETE", `/${encodeURIComponent(token)}`, undefined, [404]);
        return response.status === 204;
    }

    private async call(method : string, path : string, body? : unknown, tolerated : Array<number> = []) : Promise<Response> {
        const headers : Record<string, string> = { "x-anbaric-central-key": this.secret };
        if (body !== undefined) headers["content-type"] = "application/json";

        const response = await this.fetchFn(
            `${this.centralUrl.replace(/\/$/, "")}/tenants/${encodeURIComponent(this.tenantSlug)}/invitations${path}`,
            { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

        if (! response.ok && ! tolerated.includes(response.status)) {
            const problem = await response.json().catch(() => ({})) as { error? : string };
            throw new Error(problem.error ?? `The invitation request failed with status ${response.status}`);
        }
        return response;
    }

}

export { HttpMembershipService }
