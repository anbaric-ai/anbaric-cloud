import {Authenticator} from "./Authenticator";

const loadAuthenticator = async (moduleName? : string) : Promise<Authenticator | undefined> => {
    if (!moduleName) return undefined;

    const module = await import(moduleName);
    if (typeof module.createAuthenticator !== "function") {
        throw new Error(`Authenticator module "${moduleName}" does not export a createAuthenticator function`);
    }
    return module.createAuthenticator();
};

export { loadAuthenticator }
