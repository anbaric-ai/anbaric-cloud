import {Authenticator} from "anbaric-cloud-hosting";
import {Auth0Authenticator} from "./Auth0Authenticator";

const createAuthenticator = () : Authenticator => {
    const domain = process.env.ANBARIC_AUTH0_DOMAIN;
    const audience = process.env.ANBARIC_AUTH0_AUDIENCE;
    if (!domain || !audience) {
        throw new Error("Auth0 authentication needs ANBARIC_AUTH0_DOMAIN and ANBARIC_AUTH0_AUDIENCE");
    }

    return new Auth0Authenticator({
        domain,
        audience,
        rolesClaim: process.env.ANBARIC_AUTH0_ROLES_CLAIM,
    });
};

export { createAuthenticator };
export * from "./Auth0Authenticator";
