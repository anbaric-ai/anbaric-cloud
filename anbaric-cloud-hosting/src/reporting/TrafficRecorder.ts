import {IncomingHttpHeaders} from "node:http";
import {Request} from "../hosting/Request";

/* Told of every page an app serves through the platform, which is what its
   traffic is reported from. Recording must never slow or fail the page, so
   it is fire-and-forget. */
interface TrafficRecorder {

    pageview(request : Request, appName : string) : void;

}

/* A page is an HTML document a person was given: a GET answered with
   success and HTML. Scripts, styles, images and API calls are not pages,
   and neither is a page the browser fetched speculatively in case it was
   wanted next. */
const isPageview = (request : Request, status : number, responseHeaders : IncomingHttpHeaders) : boolean => {
    if (request.method !== "GET" || status < 200 || status >= 300) return false;
    if (! String(responseHeaders["content-type"] ?? "").toLowerCase().startsWith("text/html")) return false;

    const purpose = `${request.header("sec-purpose") ?? ""} ${request.header("purpose") ?? ""}`.toLowerCase();
    return ! purpose.includes("prefetch") && ! purpose.includes("prerender");
};

export { isPageview }
export type { TrafficRecorder }
