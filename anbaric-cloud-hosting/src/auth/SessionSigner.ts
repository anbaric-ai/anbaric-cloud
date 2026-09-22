import {createHmac, timingSafeEqual} from "node:crypto";
import {ServerResponse} from "node:http";
import {SESSION_COOKIE} from "./Authenticator";
import {Role} from "./Role";
import {Tenant} from "./Tenant";
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
   ANBARIC_SESSION_TTL_SECONDS. */
class SessionSigner {

    constructor(private secret : string = process.env.ANBARIC_SESSION_SIGNING_SECRET ?? "",
                private ttlSeconds : number = configuredTtlSeconds()) {}

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
            exp: nowSeconds() + this.ttlSeconds,
        };
        const payload = base64url(JSON.stringify(claims));
        return `${payload}.${this.sign(payload)}`;
    }

    verify(token : string | undefined) : [User, Tenant | undefined] | undefined {
        if (!token || !this.configured) return undefined;

        const [payload, signature] = token.split(".");
        if (!payload || !signature || !this.signatureMatches(payload, signature)) return undefined;

        let claims : { sub? : unknown, tenant? : unknown, roles? : unknown, name? : unknown, picture? : unknown, email? : unknown, exp? : unknown };
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
        return [new User(claims.sub, roles, [], name, picture, email), tenant];
    }

    // Sets (or, for a still-valid session, refreshes) the session cookie.
    issue(response : ServerResponse, user : User, tenant? : Tenant) : void {
        const cookie = `${SESSION_COOKIE}=${this.mint(user, tenant)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${this.ttlSeconds}`;
        const existing = response.getHeader("Set-Cookie");
        if (existing === undefined) response.setHeader("Set-Cookie", cookie);
        else response.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, cookie] : [String(existing), cookie]);
    }

    // Expires the session cookie; the attributes must match issue() or the
    // browser keeps the original cookie alongside this one.
    static clear(response : ServerResponse) : void {
        response.setHeader("Set-Cookie",
            `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
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
