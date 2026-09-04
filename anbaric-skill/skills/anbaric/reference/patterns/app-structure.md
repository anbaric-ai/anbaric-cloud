# Structuring an application

Anbaric apps are ordinary Node.js ESM programs — there's no framework-imposed
layout. A little structure keeps them clean as they grow.

## The essentials

```
my-app/
├── package.json            # "type": "module", "main": "src/main.ts"
├── .anbaric/
│   └── app-config.json     # { "name": "my-app", "internalPort": 3000 }
└── src/
    ├── main.ts             # entry point: HTTP server + wiring
    ├── machine.ts          # the state machine(s)
    ├── actions/            # action run/predicate functions
    └── stores.ts           # store instances from the factories
```

- **`package.json`** — `"type": "module"` and `main` pointing at your entry file.
  Declare any npm dependencies; the platform installs them at deploy time.
- **`.anbaric/app-config.json`** — `name` (lowercase letters, digits, `-`, `_`)
  and `internalPort`. `anbaric app configure` writes it.
- **No build step.** Ship TypeScript source; it's run with `tsx`. Don't produce
  or ship `dist/`.

## The entry point

`main.ts` wires the app together and, if it serves HTTP, listens on
`process.env.PORT`:

```ts
import {createServer} from "node:http";
import {expenses} from "./machine.js";

// Construct machines at startup so they begin consuming their queue.
export {expenses};

createServer(handler).listen(Number(process.env.PORT ?? 3000));
```

Constructing a `StateMachine` subscribes it to its queue, so create your machines
once at startup and reuse them.

## Keep actions small and pure-ish

An action's `run` should compute the property changes and return them — not reach
into global state. Give each action a clear name and actor:

```ts
const chargeCard = new Action("Charge the card", new Code("billing"));
chargeCard.run = async (job) => { /* … */ return new Map([["paid", true]]); };
```

Where an action needs a collaborator (a payment client, an email service),
construct it once and close over it, or read config/secrets from the
[secret store](../features/documents-and-secrets.md).

## Configuration and secrets

- **Never** set the `ANBARIC_*` factory variables in your app — the platform
  provides them. Read your own app config from your own env vars or files.
- Keep third-party keys in the secret store, not in source.

```ts
const secrets = SecretStoreFactory.instance();
const stripeKey = await secrets.retrieve("stripe-key", actor);
```

## One app, many machines

An app can define several state machines (give each a distinct `workflowId`).
They share the app's persistence, queue and stores. Split by process/domain —
`orders`, `invoices`, `onboarding` — rather than cramming everything into one
machine.

## See also

- [Build your first app](first-app.md)
- [Deploying](../features/deploying.md)
- [Environment and factories](../api/environment.md)
