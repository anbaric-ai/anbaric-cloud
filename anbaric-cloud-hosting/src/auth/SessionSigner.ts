import {createHmac, timingSafeEqual} from "node:crypto";
import {ServerResponse} from "node:http";
import {SESSION_COOKIE} from "./Authenticator";
import {Role} from "./Role";
import {Tenant} from "./Tenant";
import {TenantRole, isTenantRole} from "./TenantRole";
import {User} from "./User";

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

const configuredTtlSeconds = () => {
    const seconds = Number(process.env.ANBARIC_SESSION_TTL_SECONDS);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_TTL_SECONDS;
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

const base64url = (input : Buffer | string) => Buffer.from(input).toString("base64url");

/* A stateless, platform-signed session. Once an identity provider has proved
   who the user is (once, at login), the browser holds a signed cookie carrying
   the user, tenant and roles; every later request is authenticated by verifying
   the signature - no per-request identity-provider round-trip and no session
   store. The signing secret lives in the environment
   (ANBARIC_SESSION_SIGNING_SECRET, sourced from a secret manager); with none
   set the signer is inert and the platform falls back to the authenticator.
   Sessions slide: a valid one is re-issued with a fresh expiry on each request.
   The lifetime defaults to 30 days and can be tuned with
   ANBARIC_SESSION_TTL_SECONDS.

   Apps live on their own hostnames under the platform's, so the cookie is
   scoped to the shared domain (ANBARIC_COOKIE_DOMAIN) when one is configured:
   one login covers the console and every app. */
class SessionSigner {

    constructor(private secret : string = process.env.ANBARIC_SESSION_SIGNING_SECRET ?? "",
                private ttlSeconds : number = configuredTtlSeconds(),
                private domain : string | undefined = process.env.ANBARIC_COOKIE_DOMAIN || undefined) {}

    get configured() : boolean {
        return this.secret.length > 0;
    }

    mint(user : User, tenant? : Tenant) : string {
        const claims = {
            sub: user.id,
            tenant: tenant?.id,
            roles: user.roles.map(role => role.id),
            name: user.name,
            picture: user.picture,
            email: user.email,
            tenantRole: user.tenantRole,
            exp: nowSeconds() + this.ttlSeconds,
        };
        const payload = base64url(JSON.stringify(claims));
        return `${payload}.${this.sign(payload)}`;
    }

    verify(token : string | undefined) : [User, Tenant | undefined] | undefined {
        if (!token || !this.configured) return undefined;

        const [payload, signature] = token.split(".");
        if (!payload || !signature || !this.signatureMatches(payload, signature)) return undefined;

        let claims : { sub? : unknown, tenant? : unknown, roles? : unknown, name? : unknown, picture? : unknown, email? : unknown, tenantRole? : unknown, exp? : unknown };
        try {
            claims = JSON.parse(Buffer.from(payload, "base64url").toString());
        } catch {
            return undefined;
        }
        if (typeof claims.sub !== "string" || typeof claims.exp !== "number" || claims.exp < nowSeconds()) {
            return undefined;
        }

        const roles = Array.isArray(claims.roles) ? claims.roles.map(id => new Role(String(id))) : [];
        const tenant = typeof claims.tenant === "string" ? new Tenant(claims.tenant) : undefined;
        const name = typeof claims.name === "string" ? claims.name : undefined;
        const picture = typeof claims.picture === "string" ? claims.picture : undefined;
        const email = typeof claims.email === "string" ? claims.email : undefined;
        const tenantRole = isTenantRole(claims.tenantRole) ? claims.tenantRole as TenantRole : undefined;
        return [new User(claims.sub, roles, [], name, picture, email, tenantRole), tenant];
    }

    // Sets (or, for a still-valid session, refreshes) the session cookie.
    issue(response : ServerResponse, user : User, tenant? : Tenant) : void {
        this.setCookies(response, [`${SESSION_COOKIE}=${this.mint(user, tenant)}; ${this.attributes(this.ttlSeconds)}`, ...this.hostOnlyExpiry()]);
    }

    // Expires the session cookie; the attributes must match issue() or the
    // browser keeps the original cookie alongside this one.
    clear(response : ServerResponse) : void {
        this.setCookies(response, [`${SESSION_COOKIE}=; ${this.attributes(0)}`, ...this.hostOnlyExpiry()]);
    }

    private setCookies(response : ServerResponse, cookies : Array<string>) : void {
        const existing = response.getHeader("Set-Cookie");
        const before = existing === undefined ? [] : Array.isArray(existing) ? existing : [String(existing)];
        response.setHeader("Set-Cookie", [...before, ...cookies]);
    }

    private attributes(maxAge : number, domain = this.domain) : string {
        return `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}${domain ? `; Domain=${domain}` : ""}`;
    }

    /* A browser that logged in before the cookie was scoped to the domain still
       holds a host-only cookie of the same name, sends it first, and would be
       refused for ever. Expiring that variant alongside the real cookie ends
       it on the first response. */
    private hostOnlyExpiry() : Array<string> {
        return this.domain ? [`${SESSION_COOKIE}=; ${this.attributes(0, "")}`] : [];
    }

    private sign(payload : string) : string {
        return createHmac("sha256", this.secret).update(payload).digest("base64url");
    }

    private signatureMatches(payload : string, signature : string) : boolean {
        const expected = Buffer.from(this.sign(payload));
        const actual = Buffer.from(signature);
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    }

}

export { SessionSigner }
