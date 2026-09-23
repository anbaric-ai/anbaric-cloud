import {Inviter, MembershipService, PendingInvitation} from "./MembershipService";
import {isTenantRole, TenantRole} from "./TenantRole";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

const ROLE_CACHE_TTL_MS = 60_000;

/* Talks to the central login about this one tenant, with the same central api
   key the platform already holds for CLI key lookups. Roles are cached briefly
   - every authenticated request asks for one, and a minute's staleness on a
   role change is a fair trade for not calling central on each of them. */
class HttpMembershipService implements MembershipService {

    private roles = new Map<string, { role : TenantRole | undefined, expires : number }>();

    constructor(private centralUrl : string, private secret : string, private tenantSlug : string,
                private fetchFn : FetchFn = (url, init) => fetch(url, init),
                private cacheTtlMs : number = ROLE_CACHE_TTL_MS) {}

    async roleFor(userId : string) : Promise<TenantRole | undefined> {
        const cached = this.roles.get(userId);
        if (cached && cached.expires > Date.now()) return cached.role;

        const response = await this.call("GET", `/members/${encodeURIComponent(userId)}`, undefined, [404]);
        const role = response.status === 404
            ? undefined
            : (await response.json() as { role? : unknown }).role;
        const found = isTenantRole(role) ? role : undefined;

        this.roles.set(userId, { role: found, expires: Date.now() + this.cacheTtlMs });
        return found;
    }

    async invite(email : string, role : TenantRole, invitedBy : Inviter) : Promise<PendingInvitation> {
        const response = await this.call("POST", "/invitations", { email, role, invitedBy });
        return await response.json() as PendingInvitation;
    }

    async pending(asking : Inviter) : Promise<Array<PendingInvitation>> {
        const response = await this.call("GET", "/invitations", undefined, [], asking);
        return await response.json() as Array<PendingInvitation>;
    }

    async revoke(token : string, asking : Inviter) : Promise<boolean> {
        const response = await this.call("DELETE", `/invitations/${encodeURIComponent(token)}`, undefined, [403, 404], asking);
        return response.status === 204;
    }

    private async call(method : string, path : string, body? : unknown,
                       tolerated : Array<number> = [], asking? : Inviter) : Promise<Response> {
        const headers : Record<string, string> = { "x-anbaric-central-key": this.secret };
        if (body !== undefined) headers["content-type"] = "application/json";
        // Central checks the acting person's role, not just the api key, so who
        // is asking travels on every call that is not already carrying them.
        if (asking) headers["x-anbaric-user"] = asking.id;

        const response = await this.fetchFn(
            `${this.centralUrl.replace(/\/$/, "")}/tenants/${encodeURIComponent(this.tenantSlug)}${path}`,
            { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

        if (! response.ok && ! tolerated.includes(response.status)) {
            const problem = await response.json().catch(() => ({})) as { error? : string };
            throw new Error(problem.error ?? `The request to the central login failed with status ${response.status}`);
        }
        return response;
    }

}

export { HttpMembershipService }
