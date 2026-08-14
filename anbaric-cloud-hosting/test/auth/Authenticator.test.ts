import {describe, expect, it} from "vitest";
import {Authenticator} from "../../src/auth/Authenticator";
import {KeyPair} from "../../src/auth/KeyPair";
import {Role} from "../../src/auth/Role";
import {User} from "../../src/auth/User";

class StubAuthenticator extends Authenticator {

    async authenticate(token : string) : Promise<User> {
        if (token !== "valid") throw new Error("Not authenticated");
        return new User("user-1", [new Role("admin")]);
    }

}

describe("User", () => {

    it("defaults to no roles and no key pairs", () => {
        const user = new User("user-1");

        expect(user.roles).toEqual([]);
        expect(user.keyPairs).toEqual([]);
    });

    it("knows which roles it holds", () => {
        const user = new User("user-1", [new Role("admin")], [new KeyPair("kp-1", "public-key")]);

        expect(user.hasRole(new Role("admin"))).toBe(true);
        expect(user.hasRole(new Role("operator"))).toBe(false);
    });

});

describe("Authenticator", () => {

    const authenticator = new StubAuthenticator();

    it("authenticates a valid token into a user", async () => {
        const user = await authenticator.authenticate("valid");

        expect(user.id).toBe("user-1");
    });

    it("rejects an invalid token", async () => {
        await expect(authenticator.authenticate("bogus")).rejects.toThrowError("Not authenticated");
    });

    it("authorizes a user holding the required role", async () => {
        const user = await authenticator.authenticate("valid");

        expect(authenticator.authorize(user, new Role("admin"))).toBe(true);
        expect(authenticator.authorize(user, new Role("operator"))).toBe(false);
    });

});
