import {Authenticator} from "./Authenticator";
import {StubAuthenticator} from "./StubAuthenticator";

const loadAuthenticator = async (moduleName? : string) : Promise<Authenticator | undefined> => {
    if (!moduleName) return undefined;
    if (moduleName === "stub") return new StubAuthenticator();

    const module = await import(moduleName);
    if (typeof module.createAuthenticator !== "function") {
        throw new Error(`Authenticator module "${moduleName}" does not export a createAuthenticator function`);
    }
    return module.createAuthenticator();
};

export { loadAuthenticator }
