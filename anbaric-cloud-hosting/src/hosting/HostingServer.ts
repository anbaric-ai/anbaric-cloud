import {createServer, IncomingMessage, Server, ServerResponse} from "node:http";
import {AddressInfo} from "node:net";
import {JobPersistence, JsonStore, SecretStore} from "anbaric-tsapi";
import {BuildLayer} from "../app-management/BuildLayer";
import {Authenticator, SESSION_COOKIE} from "../auth/Authenticator";
import {User} from "../auth/User";
import {ConfirmableQueue} from "../queuing/ConfirmableQueue";
import {ConsumerRegistry} from "../queuing/ConsumerRegistry";
import {Router} from "./Router";

class HostingServer {

    private server : Server;
    private router : Router;

    constructor(persistence : JobPersistence, queue : ConfirmableQueue,
                registry : ConsumerRegistry = new ConsumerRegistry(),
                buildLayer? : BuildLayer,
                documentStoreFor? : (collection : string) => JsonStore,
                secretStore? : SecretStore,
                private authenticator? : Authenticator) {
        this.router = new Router(persistence, queue, registry, buildLayer, documentStoreFor, secretStore);
        this.server = createServer((request, response) => {
            this.handle(request, response).catch(error => {
                const message = error instanceof Error ? error.message : "Internal error";
                const status = /^No .+ found/.test(message) ? 404 : 500;
                this.reply(response, status, { error: message });
            });
        });
    }

    listen(port : number) : Promise<number> {
        return new Promise(resolve =>
            this.server.listen(port, () => resolve((this.server.address() as AddressInfo).port)));
    }

    close() : Promise<void> {
        return new Promise((resolve, reject) =>
            this.server.close(error => error ? reject(error) : resolve()));
    }

    private async handle(request : IncomingMessage, response : ServerResponse) : Promise<void> {
        if (request.url?.split("?")[0] === "/ping" && request.method === "GET") {
            return this.reply(response, 200, { status: "ok" });
        }

        const user = await this.authenticateSession(request, response);
        if (this.authenticator && !user) return;

        if (this.authenticator && user) {
            const permitted = await this.authenticator.authorize(user, request, response);
            if (!permitted) {
                if (!response.writableEnded) this.reply(response, 403, { error: "Not authorized" });
                return;
            }
        }

        await this.router.route(request, response, user);
    }

    private async authenticateSession(request : IncomingMessage, response : ServerResponse) : Promise<User | undefined> {
        if (!this.authenticator) return undefined;
        return this.authenticator.authenticate(this.sessionCookie(request), request, response);
    }

    private sessionCookie(request : IncomingMessage) : string | undefined {
        const cookies = String(request.headers.cookie ?? "").split(";");
        for (const cookie of cookies) {
            const [name, ...value] = cookie.trim().split("=");
            if (name === SESSION_COOKIE) return value.join("=");
        }
        return undefined;
    }

    private reply(response : ServerResponse, status : number, body : unknown) : void {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(body));
    }

}

export { HostingServer }
