import {Agent, AgentRequest} from "anbaric-tsapi";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

type AnbaricServicesConnection = {
    baseUrl? : string,
    apiKey? : string,
};

const DEFAULT_SERVICES_URL = "http://localhost:8790";

/* The functional half of a legacy Anbaric agent: hands the request to the
   additional-services agentic API, which runs the completion against the
   JSON Schema and returns the conforming output. The service URL and API key
   default from the environment (ANBARIC_SERVICES_URL, ANBARIC_SERVICES_API_KEY),
   falling back to localhost so an app co-located with the service works with
   no configuration. */
class AnbaricServicesClient extends Agent.Client {

    private baseUrl : string;
    private apiKey? : string;

    constructor(connection : AnbaricServicesConnection = {},
                private fetchFn : FetchFn = (url, init) => fetch(url, init)) {
        super();
        this.baseUrl = connection.baseUrl ?? process.env.ANBARIC_SERVICES_URL ?? DEFAULT_SERVICES_URL;
        this.apiKey = connection.apiKey ?? process.env.ANBARIC_SERVICES_API_KEY;
    }

    async generate(request : AgentRequest) : Promise<Record<string, any>> {
        const instructions = request.messages.filter(message => message.role === "system")
            .map(message => message.content).join("\n\n") || "Produce output conforming to the schema.";
        const input = request.messages.filter(message => message.role !== "system");

        const response = await this.fetchFn(`${this.baseUrl}/agentic-actions`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
            },
            body: JSON.stringify({ instructions, input, outputSchema: request.outputSchema }),
        });

        if (!response.ok) {
            const problem = await response.json().catch(() => ({}));
            throw new Error(`The Anbaric agent service failed with status ${response.status}${problem.error ? `: ${problem.error}` : ""}`);
        }

        return (await response.json()).output;
    }

}

/* A light agent backed by the legacy Anbaric agents, reached through the
   additional-services API. */
class AnbaricServicesAgent extends Agent {

    constructor(id : string, role : string, connection : AnbaricServicesConnection = {},
                fetchFn : FetchFn = (url, init) => fetch(url, init)) {
        super(id, role, new AnbaricServicesClient(connection, fetchFn));
    }

}

export { AnbaricServicesAgent, AnbaricServicesClient }
export type { AnbaricServicesConnection }
