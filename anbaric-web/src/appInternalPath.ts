/* The app-proxy URL convention, in one place. A Node app deployed under
   /app/<name> is served with that prefix stripped, so an absolute-path URL it
   emits - a sub-page like "/orders", a resource like "/styles.css", or an Await
   resolveUrl like "/approve?job=1" - points at the platform root rather than the
   app. These helpers map such a path back onto its app at /app/<name>/<path>.

   The core conditional rewrite - appInternalPath - is shared by both uses: the
   server's Referer-based link recovery derives the app name from the Referer,
   while a plugin presenting an Await resolveUrl supplies it directly (the app is
   known from the job's app_id). Keeping the rule here means both agree on what
   "an app-internal absolute path" is and how it maps onto /app/<name>. */

const KNOWN_PREFIXES = ["/api", "/app"];

const isKnownPrefix = (pathname : string) : boolean =>
    KNOWN_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

/* Places an absolute path onto the named app at /app/<appName>/<path>, or
   returns undefined (leave the path untouched) when there is no app, the path
   is not absolute (a relative or fully-qualified URL), or it is already under a
   known platform prefix (/api, /app - including an already-correct /app/... ). */
const appInternalPath = (appName : string | undefined, pathname : string, search : string = "") : string | undefined => {
    if (!appName) return undefined;
    if (!pathname.startsWith("/")) return undefined;
    if (isKnownPrefix(pathname)) return undefined;
    return `/app/${appName}${pathname}${search}`;
};

/* The same rule for a whole URL string (path plus any query/hash), returning the
   rewritten URL, or the original unchanged when it should be left alone. Use
   this where a URL is presented rather than routed - e.g. an Await resolveUrl. */
const appInternalUrl = (appName : string | undefined, url : string) : string => {
    const separator = url.search(/[?#]/);
    const pathname = separator === -1 ? url : url.slice(0, separator);
    const search = separator === -1 ? "" : url.slice(separator);
    return appInternalPath(appName, pathname, search) ?? url;
};

const refererAppName = (referer : string | undefined) : string | undefined => {
    if (!referer) return undefined;

    let pathname : string;
    try {
        pathname = new URL(referer).pathname;
    } catch {
        pathname = referer;
    }

    const match = /^\/app\/([^/?#]+)(?:[/?#]|$)/.exec(pathname);
    return match ? match[1] : undefined;
};

const appInternalRedirect = (pathname : string, search : string, referer : string | undefined) : string | undefined =>
    appInternalPath(refererAppName(referer), pathname, search);

export { appInternalPath, appInternalUrl, appInternalRedirect, refererAppName };
