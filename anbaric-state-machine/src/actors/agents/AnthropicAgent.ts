import {Agent, AgentMessage, AgentRequest} from "anbaric-tsapi";

type FetchFn = (url : string, init : RequestInit) => Promise<Response>;

type AnthropicConnection = {
    apiKey : string,
    model : string,
    baseUrl? : string,
    version? : string,
    maxTokens? : number,
};

const TOOL_NAME = "properties";
const DEFAULT_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

/* The functional half of an Anthropic agent. Two things differ from the
   OpenAI-compatible shape: the system prompt is its own field rather than a
   message, and there is no JSON-schema response format - so the request's
   schema is offered as a single tool the model is forced to call, and the
   arguments it calls it with are the structured output. */
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
                tools: [{
                    name: TOOL_NAME,
                    description: "Return the properties to write to the job.",
                    input_schema: request.outputSchema,
                }],
                tool_choice: { type: "tool", name: TOOL_NAME },
            }),
        });

        if (!response.ok) {
            const problem = await response.json().catch(() => ({})) as { error? : { message? : string } };
            throw new Error(`The Anthropic request failed with status ${response.status}${problem.error?.message ? `: ${problem.error.message}` : ""}`);
        }

        const body = await response.json() as { content? : Array<{ type? : string, name? : string, input? : any }> };
        const called = body.content?.find(block => block.type === "tool_use" && block.name === TOOL_NAME);
        if (!called || typeof called.input !== "object" || called.input === null) {
            throw new Error("The Anthropic response carried no structured content");
        }
        return called.input;
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
