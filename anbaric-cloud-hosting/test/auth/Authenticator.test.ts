import {describe, expect, it} from "vitest";
import {IncomingMessage, ServerResponse} from "node:http";
import {Authenticator} from "../../src/auth/Authenticator";
import {KeyPair} from "../../src/auth/KeyPair";
import {Role} from "../../src/auth/Role";
import {Tenant} from "../../src/auth/Tenant";
import {User} from "../../src/auth/User";

const fakeRequest = (url : string = "/") => ({ url }) as IncomingMessage;

class FakeResponse {

    status? : number;
    headers : Record<string, any> = {};
    ended = false;

    writeHead(status : number, headers? : Record<string, any>) {
        this.status = status;
        Object.assign(this.headers, headers ?? {});
        return this;
    }

    end() {
        this.ended = true;
    }

}

const fakeResponse = () => new FakeResponse();
const asServerResponse = (response : FakeResponse) => response as unknown as ServerResponse;

class StubAuthenticator extends Authenticator {

    async authenticate(session : string | undefined, _request : IncomingMessage,
                       response : ServerResponse) : Promise<[User, Tenant] | undefined> {
        if (session === "valid") return [new User("user-1", [new Role("admin")]), new Tenant("internal")];
        response.writeHead(302, { location: "https://login.example/" });
        response.end();
        return undefined;
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

    it("authenticates a valid session into a user and tenant", async () => {
        const response = fakeResponse();

        const [user, tenant] = (await authenticator.authenticate("valid", fakeRequest(), asServerResponse(response)))!;

        expect(user.id).toBe("user-1");
        expect(tenant.id).toBe("internal");
        expect(response.ended).toBe(false);
    });

    it("takes over the response when there is no valid session", async () => {
        const response = fakeResponse();

        const user = await authenticator.authenticate(undefined, fakeRequest(), asServerResponse(response));

        expect(user).toBeUndefined();
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("https://login.example/");
        expect(response.ended).toBe(true);
    });

    it("authorizes every request by default", async () => {
        const user = new User("user-1");

        expect(await authenticator.authorize(user, fakeRequest(), asServerResponse(fakeResponse()))).toBe(true);
    });

});
