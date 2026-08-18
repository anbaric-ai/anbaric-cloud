# anbaric-services-client

Client for the Anbaric **additional-services** agentic API. It exposes
`AnbaricServicesAgent` — a light `Agent` (an actor) whose LLM output is generated
by a hosted additional-services instance rather than by calling a model provider
directly. Use it the same way you would `OpenAIAgent`, when your app should reach
the model through the shared Anbaric service (the legacy-agent path) instead of
holding provider credentials itself.

The additional-services process is closed-source; **this client is not**. It
depends only on `anbaric-tsapi`.

## Install

```bash
npm install anbaric-services-client
```

## Usage

Pair the agent with `RemoteLLMAgenticAction`: when the action runs, the agent
generates the job's property changes against a JSON Schema.

```ts
import {PropertyDefinition, State, StateMachine, Transition} from "anbaric";
import {RemoteLLMAgenticAction} from "anbaric-state-machine";
import {AnbaricServicesAgent} from "anbaric-services-client";

// baseUrl / apiKey default from ANBARIC_SERVICES_URL / ANBARIC_SERVICES_API_KEY,
// which Anbaric Cloud injects into deployed app tasks. Locally they default to
// http://localhost:8790 with no key.
const agent = new AnbaricServicesAgent("triager", "assistant");

const triage = new RemoteLLMAgenticAction(
    "Triage the ticket",
    agent,
    [{ role: "system", content: "Decide the priority of the support ticket." }],
    {
        type: "object",
        properties: { priority: { type: "string", enum: ["low", "high"] } },
    },
);

const support = new StateMachine("support", [
    new State("open", [triage], [new Transition("prioritised", (job) => job.properties.has("priority"))]),
    new State("prioritised"),
], "open", [new PropertyDefinition("priority")]);
```

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANBARIC_SERVICES_URL` | Base URL of the additional-services instance | `http://localhost:8790` |
| `ANBARIC_SERVICES_API_KEY` | Bearer token for the service (if it requires one) | unset |

The constructor's `connection` argument (`{ baseUrl, apiKey }`) overrides both.
