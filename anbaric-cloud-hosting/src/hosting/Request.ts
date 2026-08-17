import {randomUUID} from "node:crypto";
import {IncomingMessage, ServerResponse} from "node:http";
import {Tenant} from "../auth/Tenant";
import {User} from "../auth/User";

/* One inbound request: the parsed URL and body plus everything the server's
   middleware decorates it with - session, user, tenant, ray trace id -
   before it reaches a handler. Handlers respond through reply/replyHtml and
   never touch the raw response unless they stream (the app proxy). */
class Request {

    readonly rayId : string;
    session? : string;
    user? : User;
    tenant? : Tenant;

    private parsed : URL;
    private segments : Array<string>;

    constructor(private incoming : IncomingMessage, private response : ServerResponse,
                rayId : string = randomUUID()) {
        this.rayId = rayId;
        this.parsed = new URL(incoming.url ?? "/", "http://localhost");
        this.segments = this.parsed.pathname.split("/").filter(Boolean);
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

    notFound() : void {
        this.reply(404, { error: "Not found" });
    }

}

export { Request }
