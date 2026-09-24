import {randomUUID} from "node:crypto";
import {IncomingMessage, ServerResponse} from "node:http";
import {Tenant} from "../auth/Tenant";
import {User} from "../auth/User";
import {ErrorPage, NOT_FOUND, render} from "./pages/ErrorPage";

/* One inbound request: the parsed URL and body plus everything the server's
   middleware decorates it with - session, user, tenant, ray trace id -
   before it reaches a handler. Handlers respond through reply/replyHtml and
   never touch the raw response unless they stream (the app proxy). */
class Request {

    readonly rayId : string;
    session? : string;
    user? : User;
    tenant? : Tenant;

    readonly api : boolean;

    private parsed : URL;
    private segments : Array<string>;

    constructor(private incoming : IncomingMessage, private response : ServerResponse,
                rayId : string = randomUUID()) {
        this.rayId = rayId;
        this.parsed = new URL(incoming.url ?? "/", "http://localhost");
        const raw = this.parsed.pathname.split("/").filter(Boolean);
        // The API lives under /api/v2; strip that prefix so resource/id/subresource
        // address the resource, and flag it so the router serves API handlers only there.
        this.api = raw[0] === "api" && raw[1] === "v2";
        this.segments = this.api ? raw.slice(2) : raw;
    }

    get method() : string {
        return this.incoming.method ?? "GET";
    }

    get url() : URL {
        return this.parsed;
    }

    get resource() : string | undefined {
        return this.segments[0];
    }

    get id() : string | undefined {
        return this.segments[1];
    }

    get subresource() : string | undefined {
        return this.segments[2];
    }

    get raw() : IncomingMessage {
        return this.incoming;
    }

    get rawResponse() : ServerResponse {
        return this.response;
    }

    get handled() : boolean {
        return this.response.writableEnded;
    }

    header(name : string) : string | undefined {
        const value = this.incoming.headers[name.toLowerCase()];
        return value === undefined ? undefined : String(value);
    }

    // The calling app's id, sent as an ambient header by the cloud clients, used
    // to scope app-owned resources (documents, secrets) server-side.
    get appId() : string | undefined {
        return this.header("x-anbaric-app");
    }

    query(name : string) : string | undefined {
        return this.parsed.searchParams.get(name) ?? undefined;
    }

    rawBody() : Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks : Array<Buffer> = [];
            this.incoming.on("data", chunk => chunks.push(chunk));
            this.incoming.on("error", reject);
            this.incoming.on("end", () => resolve(Buffer.concat(chunks)));
        });
    }

    async body() : Promise<any> {
        const raw = (await this.rawBody()).toString();
        return raw.length === 0 ? undefined : JSON.parse(raw);
    }

    reply(status : number, body? : unknown) : void {
        if (body === undefined) {
            this.response.statusCode = status;
            this.response.end();
            return;
        }
        this.response.writeHead(status, { "content-type": "application/json" });
        this.response.end(JSON.stringify(body));
    }

    replyHtml(page : Buffer) : void {
        this.response.writeHead(200, { "content-type": "text/html" });
        this.response.end(page);
    }

    replyJavaScript(script : string) : void {
        this.response.writeHead(200, { "content-type": "text/javascript" });
        this.response.end(script);
    }

    replyBytes(bytes : Buffer, contentType : string, headers : Record<string, string> = {}) : void {
        this.response.writeHead(200, { "content-type": contentType, "content-length": String(bytes.length), ...headers });
        this.response.end(bytes);
    }

    replyImage(image : Buffer, contentType : string, cacheSeconds : number = 0) : void {
        this.response.writeHead(200, {
            "content-type": contentType,
            ...(cacheSeconds > 0 ? { "cache-control": `public, max-age=${cacheSeconds}` } : {}),
        });
        this.response.end(image);
    }

    redirect(location : string, status : number = 302, headers : Record<string, string> = {}) : void {
        this.response.writeHead(status, { location, ...headers });
        this.response.end();
    }

    notFound() : void {
        this.replyProblem(NOT_FOUND);
    }

    /* Answers in whatever the caller can read: a person gets a page that says
       what happened, a client gets the json it was expecting. Deciding by the
       Accept header rather than by the route means an api call never has html
       pushed at it, and a browser never sees a bare error object. */
    replyProblem(page : ErrorPage) : void {
        const retry = page.retryAfter ? { "retry-after": String(page.retryAfter) } : {};

        if (! this.wantsHtml()) {
            this.response.writeHead(page.status, { "content-type": "application/json", ...retry });
            this.response.end(JSON.stringify({ error: page.heading, detail: page.detail }));
            return;
        }

        this.response.writeHead(page.status, {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            ...retry,
        });
        this.response.end(render(page));
    }

    private wantsHtml() : boolean {
        return String(this.header("accept") ?? "").includes("text/html");
    }

}

export { Request }
