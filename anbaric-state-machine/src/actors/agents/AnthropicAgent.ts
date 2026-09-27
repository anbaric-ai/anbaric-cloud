import {Agent, AgentMessage, AgentRequest} from "anbaric-tsapi";
import {strictSchema} from "./strictSchema.js";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

type AnthropicConnection = {
    apiKey : string,
    model : string,
    baseUrl? : string,
    version? : string,
    maxTokens? : number,
};

const DEFAULT_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

/* The functional half of an Anthropic agent. It asks for the request's schema
   through the Messages API's structured output (output_config.format), which
   every current model supports; forcing a tool call, the older way to get
   JSON out, is rejected by Claude Opus 5.5 and later. The system prompt is its
   own field rather than a message, and the reply is read from the content
   block typed "text" - thinking blocks come first on the newer models, so
   position means nothing. */
class AnthropicClient extends Agent.Client {

    private baseUrl : string;

    constructor(private connection : AnthropicConnection,
                private fetchFn : FetchFn = (url, init) => fetch(url, init)) {
        super();
        this.baseUrl = connection.baseUrl ?? "https://api.anthropic.com/v1";
    }

    async generate(request : AgentRequest) : Promise<Record<string, any>> {
        const system = request.messages.filter(message => message.role === "system")
            .map(message => message.content).join("\n\n");

        const response = await this.fetchFn(`${this.baseUrl}/messages`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": this.connection.apiKey,
                "anthropic-version": this.connection.version ?? DEFAULT_VERSION,
            },
            body: JSON.stringify({
                model: this.connection.model,
                max_tokens: this.connection.maxTokens ?? DEFAULT_MAX_TOKENS,
                ...(system ? { system } : {}),
                messages: this.conversation(request.messages),
                output_config: { format: { type: "json_schema", schema: strictSchema(request.outputSchema) } },
            }),
        });

        if (!response.ok) {
            const problem = await response.json().catch(() => ({})) as { error? : { message? : string } };
            throw new Error(`The Anthropic request failed with status ${response.status}${problem.error?.message ? `: ${problem.error.message}` : ""}`);
        }

        const body = await response.json() as { content? : Array<{ type? : string, text? : string }> };
        const text = body.content?.find(block => block.type === "text" && typeof block.text === "string")?.text;
        if (text === undefined) throw new Error("The Anthropic response carried no structured content");

        let properties : unknown;
        try {
            properties = JSON.parse(text);
        } catch {
            throw new Error("The Anthropic response was not the JSON it was asked for");
        }
        if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
            throw new Error("The Anthropic response carried no structured content");
        }
        return properties as Record<string, any>;
    }

    // The conversation Anthropic sees: system messages are lifted out, and the
    // turns must start with the user, so a conversation opening on an assistant
    // turn is left to the API to reject rather than silently reshaped.
    private conversation(messages : Array<AgentMessage>) {
        return messages
            .filter(message => message.role !== "system")
            .map(message => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }));
    }

}

/* A light agent backed by the Anthropic Messages API. */
class AnthropicAgent extends Agent {

    constructor(id : string, role : string, connection : AnthropicConnection,
                fetchFn : FetchFn = (url, init) => fetch(url, init)) {
        super(id, role, new AnthropicClient(connection, fetchFn));
    }

}

export { AnthropicAgent, AnthropicClient }
export type { AnthropicConnection }
