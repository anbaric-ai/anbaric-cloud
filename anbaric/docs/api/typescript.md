# API — TypeScript

The `anbaric` package is the umbrella install for building an app. It re-exports
the app-facing surface of the underlying packages, so a single import covers
almost everything:

```ts
import {
    StateMachine, State, Terminal, Action, Await, Transition,
    Job, PropertyDefinition,
    Code, Human, SystemActor, Agent, OpenAIAgent, AnthropicAgent, GeminiAgent, RemoteLLMAgenticAction,
    JsonStoreFactory, SecretStoreFactory, SqlStoreFactory, FileStorageFactory, PromptManagerFactory,
    registerEntitlement, hasEntitlement,
} from "anbaric";

import type {Actor, ActorType, JsonSchema} from "anbaric";
```

An Anbaric app is a standard Node.js **ESM** program in TypeScript: set
`"type": "module"` in `package.json`, point `main` at your entry file (e.g.
`src/main.ts`), and run it with `tsx`.

## Reference by area

- **[State machines](state-machine.md)** — `StateMachine`, `State`, `Terminal`,
  `Action`, `Await`, `WaitForInput`, `Transition`, `Job`, `PropertyDefinition`,
  `Actor`.
- **[Actors and agents](actors-and-agents.md)** — `Code`, `Human`,
  `SystemActor`, `Agent`, `RemoteLLMAgenticAction`, `OpenAIAgent`, `AnthropicAgent`, `GeminiAgent`.
- **[Stores](stores.md)** — `JsonStore`, `SecretStore`, `SqlStore`, `FileStorage`,
  `PromptManager` and their factories, plus `JsonSchema`.
- **[Entitlements](../features/entitlements.md)** — `registerEntitlement`,
  `hasEntitlement`.
- **[Environment and factories](environment.md)** — the `ANBARIC_*` variables
  the factories read.

## Conventions across the API

A few patterns recur throughout the library:

- **Behaviour is injected as function fields**, not via subclassing. You
  configure objects by assigning their functions: `action.run`,
  `action.predicate`, `transition`'s predicate, `propertyDefinition.validation`,
  `await.resolveUrl`, `await.metadata`.
- **Actions return changes; the machine applies them.** `run` returns a
  `Map<string, any>` of property changes — it never mutates the job. Changes are
  validated against the schema before being applied.
- **Every write takes an actor**, for auditing and authorization. Pass a
  meaningful one (`new Human(...)`, `Human.fromSession(req)`), not a placeholder.
- **Collaborators default from factories.** `StateMachine` (and the store
  factories) pick persistence, queueing, stores and auditing from the
  environment — you only pass them explicitly in tests.
- **Interfaces are async** (`Promise`-returning) because an implementation may
  cross a process boundary when deployed.

## Narrower installs

`anbaric` re-exports these packages; depend on them individually if you want a
smaller surface:

| Package | Contents |
| --- | --- |
| [`anbaric-tsapi`](https://npmjs.com/package/anbaric-tsapi) | Interfaces and value classes: `Job`, `State`, `Action`, `Await`, `Transition`, `Actor`, `JsonStore`, `SecretStore`, `SqlStore`, `FileStorage`, `Auditor`. |
| [`anbaric-state-machine`](https://npmjs.com/package/anbaric-state-machine) | `StateMachine`, actors, agents, and in-memory implementations. |
| [`anbaric-data-store`](https://npmjs.com/package/anbaric-data-store) | The document, secret and SQL stores. |
| [`anbaric-impl-cloud`](https://npmjs.com/package/anbaric-impl-cloud) | The clients used when an app is deployed. |

## See also

- [Web APIs](web.md) — serving HTTP and the platform endpoints
- [CLI reference](cli.md)
