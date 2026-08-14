import {CliOptions} from "./CliConfig";

class PlatformClient {

    constructor(private options : CliOptions) {}

    get platformUrl() : string {
        return this.options.platformUrl;
    }

    get tenant() : string | undefined {
        return this.options.tenant;
    }

    async get(path : string) : Promise<any> {
        return this.request("GET", path);
    }

    async postBinary(path : string, body : Buffer, contentType : string) : Promise<any> {
        return this.request("POST", path, new Uint8Array(body), contentType);
    }

    private async request(method : string, path : string, body? : BodyInit, contentType? : string) : Promise<any> {
        const headers : Record<string, string> = {};
        if (contentType) headers["content-type"] = contentType;
        if (this.options.tenant) headers["x-anbaric-tenant"] = this.options.tenant;

        const response = await fetch(`${this.options.platformUrl}${path}`, { method, headers, body });
        if (!response.ok) {
            const problem = await response.json().catch(() => ({}));
            throw new Error(problem.error ?? `${method} ${path} failed with status ${response.status}`);
        }
        if (response.status === 204) return undefined;
        return response.json();
    }

}

export { PlatformClient }
