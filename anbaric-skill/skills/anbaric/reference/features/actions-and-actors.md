# Actions and actors

An **action** is a unit of work that runs while a job sits in a state. Every
action declares the **actor** that performs it — recorded for auditing and used
for authorization.

## Actions

An `Action` has a `name`, an `actor`, and two replaceable functions you assign:

```ts
import {Action, Code} from "anbaric";

const chargeCard = new Action("Charge the card", new Code("billing"));

chargeCard.predicate = (job) => job.properties.get("paid") !== true;   // skip if already paid
chargeCard.run = async (job) => {
    const amount = job.properties.get("total");
    // ... call your payment provider ...
    return new Map([["paid", true], ["chargedAmount", amount]]);
};
```

- **`predicate(job) => boolean`** — return `false` to skip this action for this
  job. Defaults to always-run.
- **`run(job) => Promise<Map<string, any>>`** — do the work and **return the
  property changes**. An action never mutates the job; the machine validates the
  returned properties against the schema and applies them. Properties not in the
  schema are ignored (with a warning), so a leaky action can't corrupt a job.

Actions in a state run **in order** each time a job is processed. An action that
returns an unchanged value doesn't churn the job — the machine only advances (or
schedules a re-check) when something actually changes.

## Actors: who does the work

An actor is a small identity object — `type`, `id`, and `roles`. There are four
kinds:

| Actor | Type | Use it for |
| --- | --- | --- |
| **`Code`** | `CODE` | Automated steps that run as jobs are processed. |
| **`Human`** | `HUMAN` | Work performed by a person (e.g. via `updateJob`). |
| **`Agent`** | `AGENT` | Work produced by an AI model. See [AI agents](ai-agents.md). |
| **`System`** | `SYSTEM` | The framework itself (`SystemActor.actor`). |

```ts
import {Code, Human} from "anbaric";

new Code("billing");              // roles default to ["code"]
new Code("billing", "payments");  // a single role
new Human("ada", "admin");        // a person with the "admin" role
new Human("ada", ["admin", "finance"]);
```

Actors are **pure data** — they carry no behaviour (an `Agent`'s model call
lives in an injected client, not the actor). Constructors accept a single role
string or an array; both become `roles: Array<string>`.

## Attributing work

Whichever way a job changes, the actor is recorded:

```ts
await machine.updateJob(jobId, new Map([["approved", true]]), new Human("chris", "manager"));
await machine.executeAction(jobId, chargeCard);   // attributed to the action's actor
```

Automatic action runs are attributed to the action's `actor`. This is what makes
the [audit trail](auditing.md) meaningful: every change names who caused it.

## Identifying the logged-in person

In a deployed app that serves a web UI, turn the browser user's platform session
into a `Human` so their real identity is attributed:

```ts
import {Human} from "anbaric";

// `req` is a node:http IncomingMessage; reads the anbaric_session cookie.
const actor = await Human.fromSession(req);
await machine.updateJob(jobId, new Map([["approved", true]]), actor);
```

`Human.fromSession` also accepts the session token string directly. It resolves
the session against the platform and throws if the token is missing or invalid.
See [Serving a web UI](serving-a-web-ui.md).

## Next

- [AI agents](ai-agents.md) — let a model produce a job's properties
- [Authorization with actors and roles](../patterns/authorization.md)
- [API: Actors and agents](../api/actors-and-agents.md)
