const DEFAULT_BASE_URL = "http://localhost:8787";
const API_PREFIX = "/api/v2";
const APP_HEADER = "x-anbaric-app";

class CloudApiClient {

    constructor(private baseUrl : string) {}

    static defaultBaseUrl() : string {
        return process.env.ANBARIC_CLOUD_URL ?? DEFAULT_BASE_URL;
    }

    async request(method : string, path : string, body? : unknown) : Promise<any> {
        // Every request carries the calling app's id as an ambient header, so
        // the platform can scope app-owned resources (documents, secrets) to it
        // without the app id appearing in any URL.
        const headers : Record<string, string> = {};
        const appId = process.env.ANBARIC_APP_ID;
        if (appId) headers[APP_HEADER] = appId;
        if (body !== undefined) headers["content-type"] = "application/json";

        const response = await fetch(`${this.baseUrl}${API_PREFIX}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        if (!response.ok) {
            const problem = await response.json().catch(() => ({})) as { error? : string };
            throw new Error(problem.error ?? `${method} ${path} failed with status ${response.status}`);
        }

        if (response.status === 204) return undefined;

        return response.json();
    }

    /* The same call for bytes rather than JSON: a file goes up as its own
       content type and comes back as one, so nothing is base64'd through a
       JSON envelope and a large file is never held twice. */
    async requestBytes(method : string, path : string, body? : Uint8Array, contentType? : string) : Promise<BytesResponse> {
        const headers : Record<string, string> = {};
        const appId = process.env.ANBARIC_APP_ID;
        if (appId) headers[APP_HEADER] = appId;
        if (body !== undefined) headers["content-type"] = contentType ?? "application/octet-stream";

        const response = await fetch(`${this.baseUrl}${API_PREFIX}${path}`, {
            method, headers, body: body && new Blob([body as BlobPart]),
        });

        if (!response.ok) {
            const problem = await response.json().catch(() => ({})) as { error? : string };
            throw new Error(problem.error ?? `${method} ${path} failed with status ${response.status}`);
        }

        return {
            bytes: new Uint8Array(await response.arrayBuffer()),
            contentType: response.headers.get("content-type") ?? "application/octet-stream",
            lastModified: response.headers.get("last-modified") ?? undefined,
        };
    }

}

type BytesResponse = {
    bytes : Uint8Array,
    contentType : string,
    lastModified? : string,
};

export { CloudApiClient }
export type { BytesResponse }
