# anbaric

Everything needed to write an Anbaric app, in one install. Re-exports the
full app-facing surface of [`anbaric-tsapi`](https://npmjs.com/package/anbaric-tsapi)
(contracts and value classes), [`anbaric-state-machine`](https://npmjs.com/package/anbaric-state-machine)
(the state machine and in-memory implementations),
[`anbaric-data-store`](https://npmjs.com/package/anbaric-data-store)
(document and secret stores) and [`anbaric-cloud`](https://npmjs.com/package/anbaric-cloud)
(the clients the factories switch to when deployed).

```bash
npm install anbaric
```

An Anbaric app is a plain Node/TypeScript ESM program. Requirements:
`"type": "module"` in package.json, `main` pointing at the TypeScript entry
file, run with `tsx`. Apps deployed to an Anbaric platform may currently only
depend on `anbaric-*` packages.

## The model

A **StateMachine** owns a workflow: named **States**, each with **Actions**
(work that runs when a job is processed in that state) and **Transitions**
(predicates deciding the next state). A **Job** moves through the machine
carrying a `Map` of properties validated against **PropertyDefinitions**.
Every Action declares an **Actor** (`Code`, `Human` or `Agent` — pure
identity objects with `type`, `id`, `role`); `Code` actions run
automatically, the other types are placeholders for human/agent work.

```ts
import {Action, Code, PropertyDefinition, State, StateMachine, Transition} from "anbaric";

const flag = new PropertyDefinition("welcomeSent");
flag.validation = (value) => typeof value === "boolean";
const email = new PropertyDefinition("email");
email.required = true;

const sendWelcome = new Action("Send welcome email", new Code("send-welcome"));
sendWelcome.run = async (job) => new Map([["welcomeSent", true]]);

const customers = new StateMachine(
    "customer-onboarding",
    [
        new State("new", [sendWelcome],
            [new Transition("active", job => job.properties.get("welcomeSent") === true)]),
        new State("active"),
    ],
    "new",
    [email, flag],
);

const job = await customers.startJob(new Map([["email", "ada@example.com"]]));
```

Key rules an agent must respect:

- **Actions return properties, they do not mutate the job**: `run` returns a
  `Promise<Map<string, any>>` of property changes. Every returned property
  must exist in the machine's schema or the change is discarded.
- **Every property a job ever carries needs a `PropertyDefinition`** —
  including ones actions set. Unknown properties make updates invalid.
- **Three ways to influence a job**: `updateJob(jobId, properties, actor)`
  (explicit change, actor declared), `executeAction(jobId, action)` (run one
  action now, actor embedded), or subscribing actions to states (automatic on
  processing). All are schema-validated and audited.
- **Jobs carry history**: `startedAt`, `startedBy`, `lastUpdated`, and
  `transitions` (`{from, to, actor}` for every state change).

## Local versus deployed

Persistence, queueing and consumers come from env-driven factories. With no
environment set, everything is in-memory and jobs progress automatically —
`npx tsx src/main.ts` is a complete local run. On an Anbaric platform the
same factories talk to the platform because it injects
`ANBARIC_JOB_PERSISTENCE_TYPE=cloud`, `ANBARIC_QUEUE_TYPE=cloud`,
`ANBARIC_JSON_STORE_TYPE=cloud`, `ANBARIC_SECRET_STORE_TYPE=cloud` and
`ANBARIC_CLOUD_URL`. Never set these by hand in app code.

Documents and secrets follow the same pattern:

```ts
import {JsonStoreFactory, SecretStoreFactory} from "anbaric";

const customers = JsonStoreFactory.instance("customers", {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string" } },
});
await customers.save("ada", { name: "Ada" });

const secrets = SecretStoreFactory.instance();
await secrets.save("api-key", "s3cr3t");
```

Per-package detail: [anbaric-tsapi](https://npmjs.com/package/anbaric-tsapi)
for every contract's exact shape, [anbaric-state-machine](https://npmjs.com/package/anbaric-state-machine)
for progression semantics, [anbaric-cli](https://npmjs.com/package/anbaric-cli)
for deployment.
