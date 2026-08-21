import {Agent, AgentRequest} from "anbaric-tsapi";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

type OpenAIConnection = {
    apiKey : string,
    model : string,
    baseUrl? : string,
    organization? : string,
};

const strictSchema = (schema : any) : any => {
    if (schema?.type === "object" && schema.properties) {
        return {
            ...schema,
            required: Object.keys(schema.properties),
            additionalProperties: false,
            properties: Object.fromEntries(
                Object.entries(schema.properties).map(([key, property]) => [key, strictSchema(property)])),
        };
    }
    if (schema?.type === "array" && schema.items) {
        return { ...schema, items: strictSchema(schema.items) };
    }
    return schema;
};

/* The functional half of an OpenAI agent: asks an OpenAI-compatible chat
   completions endpoint for JSON conforming to the request's schema via
   structured outputs. */
class OpenAIClient extends Agent.Client {

    private baseUrl : string;

    constructor(private connection : OpenAIConnection,
                private fetchFn : FetchFn = (url, init) => fetch(url, init)) {
        super();
        this.baseUrl = connection.baseUrl ?? "https://api.openai.com/v1";
    }

    async generate(request : AgentRequest) : Promise<Record<string, any>> {
        const response = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "authorization": `Bearer ${this.connection.apiKey}`,
                ...(this.connection.organization ? { "openai-organization": this.connection.organization } : {}),
            },
            body: JSON.stringify({
                model: this.connection.model,
                messages: request.messages,
                response_format: {
                    type: "json_schema",
                    json_schema: { name: "properties", strict: true, schema: strictSchema(request.outputSchema) },
                },
            }),
        });

        if (!response.ok) {
            const problem = await response.json().catch(() => ({})) as { error? : { message? : string } };
            throw new Error(`The OpenAI request failed with status ${response.status}${problem.error?.message ? `: ${problem.error.message}` : ""}`);
        }

        const body = await response.json() as { choices? : Array<{ message? : { content? : string } }> };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== "string") throw new Error("The OpenAI response carried no structured content");
        return JSON.parse(content);
    }

}

/* A light agent backed by an OpenAI-compatible chat completions endpoint. */
class OpenAIAgent extends Agent {

    constructor(id : string, role : string, connection : OpenAIConnection,
                fetchFn : FetchFn = (url, init) => fetch(url, init)) {
        super(id, role, new OpenAIClient(connection, fetchFn));
    }

}

export { OpenAIAgent, OpenAIClient }
export type { OpenAIConnection }
