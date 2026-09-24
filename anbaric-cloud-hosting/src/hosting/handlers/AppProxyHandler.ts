import {IncomingHttpHeaders, OutgoingHttpHeaders, request as httpRequest} from "node:http";
import {BuildLayer} from "../../app-management/BuildLayer";
import {Request} from "../Request";
import {RequestHandler} from "../RequestHandler";
import {DEPLOYING, FAILED, NOT_RUNNING} from "../pages/ErrorPage";

/* Headers that describe a single hop and must not be forwarded across the
   proxy in either direction. */
const HOP_BY_HOP = new Set([
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
]);

/* Serves /app/<name>: the named running app is reverse-proxied to. The
   /app/<name> prefix is stripped before forwarding (the app sees the sub-path)
   and surfaced as X-Forwarded-Prefix so the app can rebuild public URLs.
   Request and response headers pass through both ways - notably cookies,
   Set-Cookie and Location - so sessions and redirects work from app-served
   HTML. */
class AppProxyHandler implements RequestHandler {

    constructor(private buildLayer : BuildLayer) {}

    async handle(request : Request) : Promise<void> {
        await this.buildLayer.ensureHydrated();
        const appName = request.id;
        if (!appName) return request.notFound();
        const app = this.buildLayer.status(appName);
        if (! app) return request.notFound();

        /* An app is torn down while its replacement builds, so a visitor who
           arrives mid-deploy would otherwise be told the app does not exist.
           It does; it is just between versions, and saying so - with a page
           that comes back on its own - is the difference between a blip and an
           outage as far as anyone watching is concerned. */
        if (app.status !== "running") {
            return request.replyProblem(
                app.status === "building" ? DEPLOYING : app.status === "failed" ? FAILED : NOT_RUNNING);
        }

        const appPath = request.url.pathname.slice(`/app/${appName}`.length) || "/";
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
        headers["x-forwarded-prefix"] = `/app/${appName}`;
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
