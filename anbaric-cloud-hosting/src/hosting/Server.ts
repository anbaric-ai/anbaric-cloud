import {createServer, IncomingMessage, Server as HttpServer, ServerResponse} from "node:http";
import {AddressInfo} from "node:net";
import {Middleware} from "./Middleware";
import {Request} from "./Request";
import {Router} from "./Router";

/* One listener: builds the Request, stamps the ray trace id, runs the
   middleware chain to decorate (or answer) it, then hands it to the
   router. */
class Server {

    private server : HttpServer;

    constructor(private router : Router, private middlewares : Array<Middleware> = []) {
        this.server = createServer((incoming, response) => {
            this.handle(incoming, response).catch(error => {
                const message = error instanceof Error ? error.message : "Internal error";
                const notFound = /^No .+ found/.test(message);
                if (! notFound) console.error(`[server] ${incoming.method} ${incoming.url} failed (ray ${response.getHeader("x-anbaric-ray") ?? "-"}):`, error);
                Server.failResponse(response, notFound ? 404 : 500, notFound ? message : Server.internalErrorMessage(response));
            });
        });
    }

    /* The last word on a request that failed. A response that has not started
       gets a status and a body; one that was already streaming when it failed
       cannot be given either, so its connection is cut instead - the client
       sees a truncated body, which is the truth. Writing headers twice would
       throw inside the error handler itself, with nothing left to catch it,
       and take the whole platform down with one dropped connection. */
    private static failResponse(response : ServerResponse, status : number, error : string) : void {
        if (response.writableEnded) return;

        if (response.headersSent) {
            response.destroy();
            return;
        }
        try {
            response.writeHead(status, { "content-type": "application/json" });
            response.end(JSON.stringify({ error }));
        } catch {
            response.destroy();
        }
    }

    /* What a failure inside the platform looks like from outside: never the
       underlying error, which names infrastructure and credentials, only a
       reference the logs can be searched for. */
    private static internalErrorMessage(response : ServerResponse) : string {
        const ray = response.getHeader("x-anbaric-ray");
        return `The platform could not complete that request${ray ? ` (reference ${ray})` : ""}`;
    }

    get listening() : boolean {
        return this.server.listening;
    }

    listen(port : number) : Promise<number> {
        return new Promise(resolve =>
            this.server.listen(port, () => resolve((this.server.address() as AddressInfo).port)));
    }

    close() : Promise<void> {
        return new Promise((resolve, reject) =>
            this.server.close(error => error ? reject(error) : resolve()));
    }

    private async handle(incoming : IncomingMessage, response : ServerResponse) : Promise<void> {
        const request = new Request(incoming, response);
        response.setHeader("x-anbaric-ray", request.rayId);

        for (const middleware of this.middlewares) {
            if (!await middleware.apply(request)) return;
        }

        await this.router.route(request);
    }

}

export { Server }
