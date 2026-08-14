import {IncomingMessage, ServerResponse} from "node:http";
import {Authenticator, Role, SESSION_COOKIE, User} from "anbaric-cloud-hosting";
import {JWTVerifyGetKey, createRemoteJWKSet, jwtVerify} from "jose";

type Auth0Options = {
    domain : string,
    clientId : string,
    clientSecret : string,
    publicUrl : string,
    rolesClaim? : string,
    organization? : string,
};

type CodeExchange = (code : string) => Promise<string>;

const DEFAULT_ROLES_CLAIM = "https://anbaric.ai/roles";
const CALLBACK_PATH = "/callback";

class Auth0Authenticator extends Authenticator {

    private issuer : string;
    private getKey : JWTVerifyGetKey;
    private exchangeCode : CodeExchange;

    constructor(private options : Auth0Options, getKey? : JWTVerifyGetKey, exchangeCode? : CodeExchange) {
        super();
        this.issuer = `https://${options.domain}/`;
        this.getKey = getKey ?? createRemoteJWKSet(new URL(`https://${options.domain}/.well-known/jwks.json`));
        this.exchangeCode = exchangeCode ?? (code => this.exchangeWithAuth0(code));
    }

    async authenticate(session : string | undefined, request : IncomingMessage,
                       response : ServerResponse) : Promise<User | undefined> {
        const url = new URL(request.url ?? "/", this.options.publicUrl);

        if (url.pathname === CALLBACK_PATH) {
            await this.handleCallback(url, response);
            return undefined;
        }

        if (session) {
            try {
                return await this.verifySession(session);
            } catch {
            }
        }

        this.redirectToLogin(url, response);
        return undefined;
    }

    private async verifySession(idToken : string) : Promise<User> {
        const { payload } = await jwtVerify(idToken, this.getKey, {
            issuer: this.issuer,
            audience: this.options.clientId,
        });

        if (this.options.organization && !this.belongsToOrganization(payload)) {
            throw new Error(`The session does not belong to the "${this.options.organization}" organization`);
        }

        const claimedRoles = payload[this.options.rolesClaim ?? DEFAULT_ROLES_CLAIM];
        const roles = Array.isArray(claimedRoles) ? claimedRoles.map(id => new Role(String(id))) : [];
        return new User(String(payload.sub), roles);
    }

    private belongsToOrganization(payload : Record<string, unknown>) : boolean {
        const organization = this.options.organization!;
        if (organization.startsWith("org_")) return payload.org_id === organization;
        return String(payload.org_name ?? "").toLowerCase() === organization.toLowerCase();
    }

    private redirectToLogin(requestedUrl : URL, response : ServerResponse) : void {
        const authorizeUrl = new URL(`https://${this.options.domain}/authorize`);
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("client_id", this.options.clientId);
        authorizeUrl.searchParams.set("redirect_uri", `${this.options.publicUrl}${CALLBACK_PATH}`);
        authorizeUrl.searchParams.set("scope", "openid profile email");
        authorizeUrl.searchParams.set("state", requestedUrl.pathname + requestedUrl.search);

        const organization = requestedUrl.searchParams.get("organization") ?? this.options.organization;
        if (organization) authorizeUrl.searchParams.set("organization", organization);

        const invitation = requestedUrl.searchParams.get("invitation");
        if (invitation) authorizeUrl.searchParams.set("invitation", invitation);

        response.writeHead(302, { location: authorizeUrl.toString() });
        response.end();
    }

    private async handleCallback(url : URL, response : ServerResponse) : Promise<void> {
        const code = url.searchParams.get("code");
        if (!code) {
            response.writeHead(401, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "Not authenticated: the login callback carried no code" }));
            return;
        }

        try {
            const idToken = await this.exchangeCode(code);
            await this.verifySession(idToken);

            const state = url.searchParams.get("state") ?? "/";
            const returnTo = state.startsWith("/") ? state : "/";
            response.writeHead(302, {
                "set-cookie": `${SESSION_COOKIE}=${idToken}; Path=/; HttpOnly; SameSite=Lax`,
                location: returnTo,
            });
            response.end();
        } catch {
            response.writeHead(401, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "Not authenticated: the login could not be completed" }));
        }
    }

    private async exchangeWithAuth0(code : string) : Promise<string> {
        const tokenResponse = await fetch(`https://${this.options.domain}/oauth/token`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                grant_type: "authorization_code",
                client_id: this.options.clientId,
                client_secret: this.options.clientSecret,
                code,
                redirect_uri: `${this.options.publicUrl}${CALLBACK_PATH}`,
            }),
        });
        if (!tokenResponse.ok) {
            throw new Error(`The Auth0 token exchange failed with status ${tokenResponse.status}`);
        }

        const tokens = await tokenResponse.json() as { id_token? : string };
        if (!tokens.id_token) {
            throw new Error("The Auth0 token exchange returned no id token");
        }
        return tokens.id_token;
    }

}

export { Auth0Authenticator, CALLBACK_PATH };
export type { Auth0Options, CodeExchange };
