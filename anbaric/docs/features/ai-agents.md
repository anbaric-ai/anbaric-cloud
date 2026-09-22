# AI agents

An **agent** is an actor whose properties are produced by a model rather than by
hand-written code. Because an agent is just another actor, its work runs inside a
state and is audited like any other — attributed to the agent.

## The shape of it

Two pieces work together:

- an **`Agent`** — the identity, plus a client that knows how to call a model;
- an **agentic action** — an `Action` that builds a request (a prompt + a JSON
  Schema), asks the agent to generate, and applies the returned properties.

`RemoteLLMAgenticAction` is the ready-made agentic action: you give it a prompt
and an output schema, and it maps the model's structured response onto the job.

## Triage a support ticket

```ts
import {OpenAIAgent, RemoteLLMAgenticAction, State, StateMachine, Transition} from "anbaric";

const triager = new OpenAIAgent("triager", "support", {
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-5.4-mini",
});

const triage = new RemoteLLMAgenticAction(
    "Triage the ticket",
    triager,
    [{ role: "system", content: "Decide the priority of the support ticket from its subject." }],
    { type: "object", properties: { priority: { type: "string", enum: ["low", "high"] } } },
);

const support = new StateMachine("support", [
    new State("open", [triage], [
        new Transition("prioritised", (job) => job.properties.has("priority")),
    ]),
    new State("prioritised"),
]);
```

When a job is processed in `open`, the agent is asked to produce a `priority`
constrained to the schema; the result is applied to the job, and the transition
advances it. The decision is recorded against `triager`.

The job's current properties are appended to the prompt automatically, so the
model sees the data it's reasoning about.

## The output schema

The second-to-last argument is a JSON Schema describing exactly what the model
must return. The model is constrained to it (strict structured output), so you
get well-typed properties back rather than free text. Keep the schema tight —
only the properties you want written to the job.

## Keep the prompt in the prompt manager

Instructions change more often than code. Rather than a string literal, save
the prompt with the [prompt manager](prompts.md) at startup and read the
latest where the action is built - every edit is versioned and visible in the
console's **Prompts** page:

```ts
import {PromptManagerFactory} from "anbaric";

const prompts = PromptManagerFactory.instance();
await prompts.save("triage", "Decide the priority of the support ticket from its subject.",
    undefined, { type: "object", properties: { priority: { type: "string", enum: ["low", "high"] } } });

const prompt = await prompts.retrieve("triage");
const triage = new RemoteLLMAgenticAction("Triage the ticket", triager,
    [{ role: "system", content: prompt.instructions }], prompt.outputSchema!);
```

## Bring your own model

`OpenAIAgent` targets any OpenAI-compatible endpoint. Configure it with a
connection object:

```ts
new OpenAIAgent("triager", "support", {
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-5.4-mini",
    baseUrl: "https://api.openai.com/v1",   // optional; override for a compatible provider
    organization: "org_...",                 // optional
});
```

For a different provider entirely, implement an `Agent.Client` (a class with a
`generate(request)` method) and pass it to a plain `Agent`. See the [API
reference](../api/actors-and-agents.md#agents-and-ai) for the client contract.

> Keep model API keys in the [secret store](documents-and-secrets.md), not in
> source. Locally you can read them from the environment as above.

## Next

- [API: Actors and agents](../api/actors-and-agents.md)
- [Modelling a workflow](../patterns/modelling-workflows.md)
