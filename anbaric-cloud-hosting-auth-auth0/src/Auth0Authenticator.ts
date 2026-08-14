import {Authenticator, Role, User} from "anbaric-cloud-hosting";
import {JWTVerifyGetKey, createRemoteJWKSet, jwtVerify} from "jose";

type Auth0Options = {
    domain : string,
    audience : string,
    rolesClaim? : string,
};

const DEFAULT_ROLES_CLAIM = "https://anbaric.ai/roles";

class Auth0Authenticator extends Authenticator {

    private issuer : string;
    private getKey : JWTVerifyGetKey;

    constructor(private options : Auth0Options, getKey? : JWTVerifyGetKey) {
        super();
        this.issuer = `https://${options.domain}/`;
        this.getKey = getKey ?? createRemoteJWKSet(new URL(`https://${options.domain}/.well-known/jwks.json`));
    }

    async authenticate(token : string) : Promise<User> {
        const payload = await this.verify(token);
        const claimedRoles = payload[this.options.rolesClaim ?? DEFAULT_ROLES_CLAIM];
        const roles = Array.isArray(claimedRoles) ? claimedRoles.map(id => new Role(String(id))) : [];

        return new User(String(payload.sub), roles);
    }

    private async verify(token : string) {
        try {
            const { payload } = await jwtVerify(token, this.getKey, {
                issuer: this.issuer,
                audience: this.options.audience,
            });
            return payload;
        } catch {
            throw new Error("Not authenticated: the token could not be verified");
        }
    }

}

export { Auth0Authenticator };
export type { Auth0Options };
