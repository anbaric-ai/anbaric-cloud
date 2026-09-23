# API — Actors and agents

Who performs work, and how AI models plug in. Import from `anbaric`.

```ts
import {Code, Human, SystemActor, Agent, OpenAIAgent, AnthropicAgent, GeminiAgent, RemoteLLMAgenticAction} from "anbaric";
import type {Actor, ActorType} from "anbaric";
```

---

## Actors

Every actor is `{ type, id, roles }`. Concrete actor constructors accept a single
role string **or** an array; a bare string is normalised to a one-element array.

### `Code`

Automated work that runs as jobs are processed.

```ts
class Code implements Actor
// type = "CODE"
constructor(id : string, roles : Array<string> | string = "code")
```

```ts
new Code("billing");                 // roles: ["code"]
new Code("billing", "payments");     // roles: ["payments"]
```

### `Human`

Work performed by a person.

```ts
class Human implements Actor
// type = "HUMAN"
constructor(id : string, roles : Array<string> | string)     // roles required

static async fromSession(
    source : string | IncomingMessage,
    resolver? : SessionResolver,
) : Promise<Human>
```

`fromSession` accepts either the `anbaric_session` **token string** or a Node
`IncomingMessage` (it reads the cookie). It resolves the session against the
platform and returns a `Human` with the resolved id and roles, or throws
`Could not resolve the session` if the token is missing/invalid/expired. See
[Web APIs](web.md#sessions) for the endpoint it uses.

```ts
new Human("ada", "admin");
new Human("ada", ["admin", "finance"]);
const user = await Human.fromSession(request);
```

### `SystemActor`

The framework itself. Use the shared singleton.

```ts
class SystemActor implements Actor    // type = "SYSTEM", id = "_SYSTEM", roles = ["_SYSTEM"]
static actor : SystemActor
```

```ts
SystemActor.actor
```

---

## Agents and AI

### `Agent`

Pure identity plus an injected client that calls a model. The `Agent` itself
holds no model logic.

```ts
class Agent implements Actor
// type = "AGENT"
constructor(id : string, roles : Array<string> | string, client : Agent.Client)

// The client contract:
namespace Agent {
    abstract class Client {
        abstract generate(request : AgentRequest) : Promise<Record<string, any>>
    }
}
```

Supporting types:

```ts
type AgentMessage = { role : "system" | "user" | "assistant", content : string }
type AgentRequest = { messages : Array<AgentMessage>, outputSchema : object }
```

Implement `Agent.Client` to target any model provider, then
`new Agent("id", "role", myClient)`.

### `RemoteLLMAgenticAction`

An `Action` that asks an agent to generate structured properties from a prompt
and applies them to the job. The job's current properties are appended to the
prompt automatically.

```ts
class RemoteLLMAgenticAction extends Action
constructor(
    name : string,
    agent : Agent,
    messages : Array<AgentMessage>,   // the prompt
    outputSchema : object,            // JSON Schema for the properties to return
    description? : string,
    id? : string,
)
```

```ts
const triage = new RemoteLLMAgenticAction(
    "Triage the ticket",
    triager,
    [{ role: "system", content: "Decide the priority from the subject." }],
    { type: "object", properties: { priority: { type: "string", enum: ["low", "high"] } } },
);
```

### `OpenAIAgent`

An `Agent` backed by an OpenAI-compatible chat-completions endpoint (uses strict
JSON-schema structured output).

```ts
class OpenAIAgent extends Agent
constructor(id : string, role : string, connection : OpenAIConnection, fetchFn? : FetchFn)

type OpenAIConnection = {
    apiKey : string,
    model : string,
    baseUrl? : string,        // default "https://api.openai.com/v1"
    organization? : string,
}
```

```ts
const triager = new OpenAIAgent("triager", "support", {
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-5.4-mini",
});
```

The optional `fetchFn` lets you inject a custom fetch (useful in tests). Requests
that fail throw `The OpenAI request failed with status <n>`.

### `AnthropicAgent`

An `Agent` backed by the Anthropic Messages API. The API has no JSON-schema
response format, so the output schema is offered as a single tool the model is
forced to call; its arguments are the structured output. System messages are
lifted out of the conversation into the API's own `system` field.

```ts
class AnthropicAgent extends Agent
constructor(id : string, role : string, connection : AnthropicConnection, fetchFn? : FetchFn)

type AnthropicConnection = {
    apiKey : string,
    model : string,
    baseUrl? : string,        // default "https://api.anthropic.com/v1"
    version? : string,        // anthropic-version header, default "2023-06-01"
    maxTokens? : number,      // the Messages API requires a budget, default 4096
}
```

Failures throw `The Anthropic request failed with status <n>`; a model that
answers with prose instead of calling the tool throws `The Anthropic response
carried no structured content`.

### `GeminiAgent`

An `Agent` backed by the Gemini generative language API, asking for JSON against
the output schema. System messages become `systemInstruction`, assistant turns
are sent as the `model` role, and the API key travels as a header rather than a
query parameter.

```ts
class GeminiAgent extends Agent
constructor(id : string, role : string, connection : GeminiConnection, fetchFn? : FetchFn)

type GeminiConnection = {
    apiKey : string,
    model : string,
    baseUrl? : string,        // default "https://generativelanguage.googleapis.com/v1beta"
}
```

Gemini's `responseSchema` is an OpenAPI subset rather than JSON Schema, so the
schema you pass is converted: types are upper-cased and keywords it rejects
(`additionalProperties` among them) are dropped. Failures throw `The Gemini
request failed with status <n>`.

---

### See also

- [Actions and actors](../features/actions-and-actors.md) — the concepts
- [AI agents](../features/ai-agents.md) — a worked example
- [State machines API](state-machine.md) — `Action`, `Actor`
