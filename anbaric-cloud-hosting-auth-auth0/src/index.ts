import {Authenticator} from "anbaric-cloud-hosting";
import {Auth0Authenticator} from "./Auth0Authenticator";

const createAuthenticator = () : Authenticator => {
    const domain = process.env.ANBARIC_AUTH0_DOMAIN;
    const clientId = process.env.ANBARIC_AUTH0_CLIENT_ID;
    const clientSecret = process.env.ANBARIC_AUTH0_CLIENT_SECRET;
    if (!domain || !clientId || !clientSecret) {
        throw new Error("Auth0 authentication needs ANBARIC_AUTH0_DOMAIN, ANBARIC_AUTH0_CLIENT_ID and ANBARIC_AUTH0_CLIENT_SECRET");
    }

    return new Auth0Authenticator({
        domain,
        clientId,
        clientSecret,
        publicUrl: process.env.ANBARIC_PLATFORM_PUBLIC_URL ?? "http://localhost:8787",
        rolesClaim: process.env.ANBARIC_AUTH0_ROLES_CLAIM,
    });
};

export { createAuthenticator };
export * from "./Auth0Authenticator";
