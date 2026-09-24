import {afterEach, describe, expect, it} from "vitest";
import {Middleware} from "../../src/hosting/Middleware";
import {Request} from "../../src/hosting/Request";
import {RequestHandler} from "../../src/hosting/RequestHandler";
import {Router} from "../../src/hosting/Router";
import {Server} from "../../src/hosting/Server";

const echoHandler : RequestHandler = {
    async handle(request : Request) {
        request.reply(200, {
            resource: request.resource,
            id: request.id,
            user: request.user?.id ?? null,
            rayId: request.rayId,
        });
    },
};

describe("Server and Router", () => {

    let server : Server | undefined;

    afterEach(async () => {
        if (server) await server.close();
        server = undefined;
    });

    const start = async (router : Router, middlewares : Array<Middleware> = []) => {
        server = new Server(router, middlewares);
        return `http://127.0.0.1:${await server.listen(0)}`;
    };

    it("routes to the handler registered for the resource", async () => {
        const router = new Router();
        router.register("things", echoHandler);
        const baseUrl = await start(router);

        const body = await (await fetch(`${baseUrl}/things/42`)).json();

        expect(body.resource).toBe("things");
        expect(body.id).toBe("42");
    });

    it("is hollow: unregistered resources 404", async () => {
        const baseUrl = await start(new Router());

        expect((await fetch(`${baseUrl}/anything`)).status).toBe(404);
        expect((await fetch(`${baseUrl}/`)).status).toBe(404);
    });

    it("routes the root and the fallback when registered", async () => {
        const router = new Router();
        router.registerRoot(echoHandler);
        router.registerFallback(echoHandler);
        const baseUrl = await start(router);

        expect((await (await fetch(`${baseUrl}/`)).json()).resource).toBeUndefined();
        expect((await (await fetch(`${baseUrl}/unregistered`)).json()).resource).toBe("unregistered");
    });

    it("stamps every response with a ray trace id matching the request's", async () => {
        const router = new Router();
        router.register("things", echoHandler);
        const baseUrl = await start(router);

        const response = await fetch(`${baseUrl}/things`);
        const body = await response.json();

        expect(response.headers.get("x-anbaric-ray")).toBeTruthy();
        expect(response.headers.get("x-anbaric-ray")).toBe(body.rayId);
    });

    it("lets middleware decorate the request before routing", async () => {
        const decorating : Middleware = {
            async apply(request : Request) {
                request.user = { id: "decorated-user", roles: [], keyPairs: [], hasRole: () => false } as any;
                return true;
            },
        };
        const router = new Router();
        router.register("things", echoHandler);
        const baseUrl = await start(router, [decorating]);

        expect((await (await fetch(`${baseUrl}/things`)).json()).user).toBe("decorated-user");
    });

    it("lets middleware answer the request and stop the chain", async () => {
        const wall : Middleware = {
            async apply(request : Request) {
                request.reply(418, { error: "stopped" });
                return false;
            },
        };
        const router = new Router();
        router.register("things", echoHandler);
        const baseUrl = await start(router, [wall]);

        expect((await fetch(`${baseUrl}/things`)).status).toBe(418);
    });

    it("maps not-found errors from handlers to 404 and the rest to 500", async () => {
        const router = new Router();
        router.register("missing", { async handle() { throw new Error('No job found with id "x"'); } });
        router.register("broken", { async handle() { throw new Error("boom"); } });
        const baseUrl = await start(router);

        expect((await fetch(`${baseUrl}/missing`)).status).toBe(404);
        expect((await fetch(`${baseUrl}/broken`)).status).toBe(500);
    });

    it("keeps a not-found message but never sends an internal error's message to the client", async () => {
        const router = new Router();
        router.register("missing", { async handle() { throw new Error('No job found with id "x"'); } });
        router.register("broken", { async handle() { throw new Error("User arn:aws:sts::1:assumed-role/x is not authorized"); } });
        const baseUrl = await start(router);

        const missing = await fetch(`${baseUrl}/missing`);
        const broken = await fetch(`${baseUrl}/broken`);

        expect(await missing.json()).toEqual({ error: 'No job found with id "x"' });
        const problem = await broken.json();
        expect(problem.error).not.toContain("arn:aws");
        expect(problem.error).toContain(`reference ${broken.headers.get("x-anbaric-ray")}`);
    });

});
