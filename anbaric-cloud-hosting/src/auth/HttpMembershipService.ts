import {Inviter, MembershipService, PendingInvitation} from "./MembershipService";
import {isTenantRole, TenantRole} from "./TenantRole";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

const ROLE_CACHE_TTL_MS = 60_000;

/* Talks to the central login about this one tenant, with the same central api
   key the platform already holds for CLI key lookups. Roles are cached briefly
   - every authenticated request asks for one, and a minute's staleness on a
   role change is a fair trade for not calling central on each of them. */
class HttpMembershipService implements MembershipService {

    private roles = new Map<string, { role : TenantRole | undefined, invitationToken? : string, expires : number }>();

    constructor(private centralUrl : string, private secret : string, private tenantSlug : string,
                private fetchFn : FetchFn = (url, init) => fetch(url, init),
                private cacheTtlMs : number = ROLE_CACHE_TTL_MS) {}

    async roleFor(userId : string) : Promise<TenantRole | undefined> {
        return (await this.membership(userId)).role;
    }

    async joinedVia(userId : string) : Promise<string | undefined> {
        return (await this.membership(userId)).invitationToken;
    }

    private async membership(userId : string) : Promise<{ role : TenantRole | undefined, invitationToken? : string }> {
        const cached = this.roles.get(userId);
        if (cached && cached.expires > Date.now()) return cached;

        const response = await this.call("GET", `/members/${encodeURIComponent(userId)}`, undefined, [404]);
        const answer = response.status === 404
            ? {}
            : await response.json() as { role? : unknown, invitationToken? : unknown };
        const found = {
            role: isTenantRole(answer.role) ? answer.role : undefined,
            invitationToken: typeof answer.invitationToken === "string" ? answer.invitationToken : undefined,
            expires: Date.now() + this.cacheTtlMs,
        };

        this.roles.set(userId, found);
        return found;
    }

    async invite(email : string, role : TenantRole, invitedBy : Inviter, landingApp? : string) : Promise<PendingInvitation> {
        const response = await this.call("POST", "/invitations", { email, role, invitedBy, landingApp });
        return await response.json() as PendingInvitation;
    }

    async inviteLink(role : TenantRole, invitedBy : Inviter, uses : number, landingApp? : string) : Promise<PendingInvitation> {
        const response = await this.call("POST", "/invitations", { link: true, uses, role, invitedBy, landingApp });
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

    async remove(userId : string, asking : Inviter) : Promise<boolean> {
        const response = await this.call("DELETE", `/members/${encodeURIComponent(userId)}`, undefined, [404], asking);
        this.roles.delete(userId);
        return response.status === 204;
    }

    async changeRole(userId : string, role : TenantRole, asking : Inviter) : Promise<TenantRole | undefined> {
        const response = await this.call("PATCH", `/members/${encodeURIComponent(userId)}`, { role }, [404], asking);
        this.roles.delete(userId);
        if (response.status === 404) return undefined;

        const changed = (await response.json() as { role? : unknown }).role;
        return isTenantRole(changed) ? changed : undefined;
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
