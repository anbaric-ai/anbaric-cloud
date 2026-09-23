import {Agent, AgentMessage, AgentRequest} from "anbaric-tsapi";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

type GeminiConnection = {
    apiKey : string,
    model : string,
    baseUrl? : string,
};

/* Gemini's responseSchema is an OpenAPI subset, not JSON Schema: its types are
   an upper-case enum and it rejects keywords it doesn't know (additionalProperties
   among them). Convert rather than pass through, keeping only what it accepts. */
const CARRIED = ["format", "description", "nullable", "enum", "required"] as const;

const geminiSchema = (schema : any) : any => {
    if (!schema || typeof schema !== "object") return schema;

    const converted : Record<string, any> = {};
    if (typeof schema.type === "string") converted.type = schema.type.toUpperCase();
    for (const key of CARRIED) {
        if (schema[key] !== undefined) converted[key] = schema[key];
    }
    if (schema.items) converted.items = geminiSchema(schema.items);
    if (schema.properties) {
        converted.properties = Object.fromEntries(
            Object.entries(schema.properties).map(([key, property]) => [key, geminiSchema(property)]));
    }
    return converted;
};

/* The functional half of a Gemini agent. Two things differ from the
   OpenAI-compatible shape: the system prompt is its own field (systemInstruction)
   and the assistant's turns are named "model"; structured output is asked for
   with a JSON response mime type plus the converted schema. */
class GeminiClient extends Agent.Client {

    private baseUrl : string;

    constructor(private connection : GeminiConnection,
                private fetchFn : FetchFn = (url, init) => fetch(url, init)) {
        super();
        this.baseUrl = connection.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    }

    async generate(request : AgentRequest) : Promise<Record<string, any>> {
        const system = request.messages.filter(message => message.role === "system")
            .map(message => message.content).join("\n\n");

        // The key travels as a header, never in the URL, so it stays out of
        // request logs and browser history.
        const response = await this.fetchFn(
            `${this.baseUrl}/models/${encodeURIComponent(this.connection.model)}:generateContent`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": this.connection.apiKey,
                },
                body: JSON.stringify({
                    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
                    contents: this.conversation(request.messages),
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: geminiSchema(request.outputSchema),
                    },
                }),
            });

        if (!response.ok) {
            const problem = await response.json().catch(() => ({})) as { error? : { message? : string } };
            throw new Error(`The Gemini request failed with status ${response.status}${problem.error?.message ? `: ${problem.error.message}` : ""}`);
        }

        const body = await response.json() as
            { candidates? : Array<{ content? : { parts? : Array<{ text? : string }> } }> };
        const text = body.candidates?.[0]?.content?.parts?.map(part => part.text).find(part => typeof part === "string");
        if (typeof text !== "string") throw new Error("The Gemini response carried no structured content");
        return JSON.parse(text);
    }

    private conversation(messages : Array<AgentMessage>) {
        return messages
            .filter(message => message.role !== "system")
            .map(message => ({
                role: message.role === "assistant" ? "model" : "user",
                parts: [{ text: message.content }],
            }));
    }

}

/* A light agent backed by the Gemini generative language API. */
class GeminiAgent extends Agent {

    constructor(id : string, role : string, connection : GeminiConnection,
                fetchFn : FetchFn = (url, init) => fetch(url, init)) {
        super(id, role, new GeminiClient(connection, fetchFn));
    }

}

export { GeminiAgent, GeminiClient, geminiSchema }
export type { GeminiConnection }
