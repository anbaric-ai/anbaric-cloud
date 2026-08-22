import {IncomingHttpHeaders, OutgoingHttpHeaders, request as httpRequest} from "node:http";
import {BuildLayer} from "../../app-management/BuildLayer";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";

/* Headers that describe a single hop and must not be forwarded across the
   proxy in either direction. */
const HOP_BY_HOP = new Set([
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
]);

/* The router's fallback: any unregistered top-level path naming a running app
   is reverse-proxied to it. The app is exposed at /<appName>; that prefix is
   stripped before forwarding (the app sees the sub-path) and surfaced to the
   app as X-Forwarded-Prefix so it can rebuild public URLs. Request and response
   headers pass through both ways - notably cookies, Set-Cookie and Location - so
   sessions and redirects work from app-served HTML. */
class AppProxyHandler implements RequestHandler {

    constructor(private buildLayer : BuildLayer) {}

    async handle(request : Request) : Promise<void> {
        const appName = request.resource!;
        const app = this.buildLayer.status(appName);
        if (!app || app.status !== "running") return request.notFound();

        const appPath = request.url.pathname.slice(`/${appName}`.length) || "/";
        const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.rawBody();

        await new Promise<void>((resolve, reject) => {
            const upstream = httpRequest({
                host: app.appHost,
                port: app.appPort,
                method: request.method,
                path: `${appPath}${request.url.search}`,
                headers: this.forwardHeaders(request, appName),
            }, response => {
                request.rawResponse.writeHead(response.statusCode ?? 502, this.passThrough(response.headers));
                response.pipe(request.rawResponse);
                response.on("end", resolve);
                response.on("error", reject);
            });
            upstream.on("error", reject);
            if (body && body.length > 0) upstream.write(body);
            upstream.end();
        });
    }

    private forwardHeaders(request : Request, appName : string) : OutgoingHttpHeaders {
        const headers = this.passThrough(request.raw.headers);
        delete headers.host;
        headers["x-forwarded-prefix"] = `/${appName}`;
        headers["x-forwarded-host"] = request.raw.headers.host;
        headers["x-forwarded-proto"] = "https";
        return headers;
    }

    private passThrough(headers : IncomingHttpHeaders) : OutgoingHttpHeaders {
        const kept : OutgoingHttpHeaders = {};
        for (const [name, value] of Object.entries(headers)) {
            if (value === undefined || HOP_BY_HOP.has(name)) continue;
            kept[name] = value;
        }
        return kept;
    }

}

export { AppProxyHandler }
