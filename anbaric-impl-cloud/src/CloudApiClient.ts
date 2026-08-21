const DEFAULT_BASE_URL = "http://localhost:8787";

class CloudApiClient {

    constructor(private baseUrl : string) {}

    static defaultBaseUrl() : string {
        return process.env.ANBARIC_CLOUD_URL ?? DEFAULT_BASE_URL;
    }

    async request(method : string, path : string, body? : unknown) : Promise<any> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: body === undefined ? undefined : { "content-type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        if (!response.ok) {
            const problem = await response.json().catch(() => ({})) as { error? : string };
            throw new Error(problem.error ?? `${method} ${path} failed with status ${response.status}`);
        }

        if (response.status === 204) return undefined;

        return response.json();
    }

}

export { CloudApiClient }
