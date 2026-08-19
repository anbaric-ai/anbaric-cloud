# anbaric

Anbaric is a Typescript framework for building stateful applications. An application is
expressed as one or more state machines: long-lived jobs move through named
states, driven by actions and transitions, with their data validated against a
schema and every change recorded in an audit trail. Alongside the state machine
the framework provides schema-validated document storage and secret storage.

Anbaric also provides a platform-as-a-service to easily deploy stateful apps built on Anbaric. The same application runs unchanged on
a developer's machine, on a server you operate, or on Anbaric Cloud, where a
single CLI command deploys it. Application code depends only on the interfaces
in this package; the framework selects in-memory or platform-backed
implementations from the environment, so no deployment detail appears in the
code.

This package (`anbaric`) is the umbrella install for writing an application. It
re-exports the app-facing surface of the underlying packages.

```bash
npm install anbaric
```

An Anbaric application is a standard Node.js ESM program written in TypeScript:
set `"type": "module"` in `package.json`, point `main` at the TypeScript entry
file, and run it with `tsx`.

## State machines

A **`StateMachine`** defines a workflow. It is constructed with an identifier, a
list of states, the name of the start state, and the property schema for its
jobs.

- A **`State`** is a named step. It holds a list of **actions** to run while a
  job sits in that state, and a list of **transitions** to the next state.
- An **`Action`** is a unit of work. Its `run` function receives the job and
  returns a `Map` of property changes: `run(job) => Promise<Map<string, any>>`.
  An action does not mutate the job directly; the returned properties are
  validated and applied by the machine. Each action declares the **actor** that
  performs it.
- A **`Transition`** names a target state and carries a predicate over the job.
  When a job is processed, the first transition whose predicate holds moves the
  job to that state.
- A **`Job`** is one instance moving through the machine. It carries an
  identifier, its current `state`, a `Map` of `properties`, and provenance
  (`workflowId`, `startedBy`, `startedAt`, `lastUpdated`). Jobs are immutable;
  each change produces a new version.
- A **`PropertyDefinition`** describes one property a job may carry: whether it
  is required and how its value is validated. Every property a job holds —
  including properties set by actions — must have a definition, or the change is
  rejected.
- An **`Actor`** identifies who performs an operation, for authorization and
  auditing. The actor types are `Code`, `Human`, `Agent` and `System`. `Code`
  actions run automatically as jobs are processed; a `Human` or `Agent` actor
  represents work performed by a person or an autonomous agent.

A job progresses automatically as it is processed: matching actions run, their
properties are applied, and the first satisfied transition advances the state.
This repeats until the job reaches a state from which nothing more applies.

There are three ways to influence a job:

- `startJob(properties?, actor?)` creates a job in the start state.
- `updateJob(jobId, properties, actor)` applies an explicit property change.
- `executeAction(jobId, action)` runs a single action immediately.
- Actions subscribed to a state run automatically whenever a job in that state
  is processed.

Every operation is validated against the schema and written to the audit trail,
which records the resource, the actor, the interactions (create, update, state
change, delete, read), and a description of what changed.

## Documents and secrets

For data that does not belong to a job, the framework provides two stores,
obtained from factories and used with an actor for auditing.

- **`JsonStore`** stores JSON documents in named collections, optionally
  validated against a JSON Schema.
- **`SecretStore`** stores named secret strings, encrypted at rest, and never
  records secret values in the audit trail.

```ts
import {Human, JsonStoreFactory, SecretStoreFactory} from "anbaric";

const actor = new Human("ada", "admin");

const customers = JsonStoreFactory.instance("customers", {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string" } },
});
await customers.create(actor, "ada", { name: "Ada" });
const record = await customers.retrieve("ada", actor);

const secrets = SecretStoreFactory.instance();
await secrets.create(actor, "api-key", "s3cr3t");
```

## Running and deploying

Persistence, queueing and consumers are supplied by environment-driven
factories, so the same application runs in several ways without code changes.

- **Local.** With no environment configured, every store, queue and consumer is
  in-memory and jobs progress automatically. Running the program with
  `npx tsx src/main.ts` is a complete local run, suitable for development and
  testing.
- **Anbaric Cloud.** `anbaric app deploy` packages the application (source only, no
  `node_modules`) and runs it on the hosted platform. The platform installs the
  application's own dependencies as it builds the image, so any npm package the
  application imports works when deployed. The platform injects the configuration
  that points the factories at platform-backed persistence, queueing, documents
  and secrets; application code is unchanged. Authentication, job inspection and
  updates are available through the CLI.
- **Self-hosted.** The [`anbaric-hosting`](https://npmjs.com/package/anbaric-hosting)
  package runs the platform — the API, dispatcher, build layer and app proxy —
  on infrastructure you operate, backed by Postgres.

Applications should not set the `ANBARIC_*` factory variables themselves; the
platform sets them when the application is deployed.

## Example

```ts
import {Action, Code, PropertyDefinition, State, StateMachine, Transition} from "anbaric";

const name = new PropertyDefinition("name");
name.required = true;

const email = new PropertyDefinition("email");
email.required = true;

const welcomeSent = new PropertyDefinition("welcomeSent");
welcomeSent.validation = (value) => typeof value === "boolean";

const sendWelcome = new Action("Send welcome email", new Code("send-welcome"));
sendWelcome.run = async (job) => {
    // ... send the email to job.properties.get("email") ...
    return new Map([["welcomeSent", true]]);
};

const onboarding = new StateMachine(
    "customer-onboarding",
    [
        new State("new", [sendWelcome], [
            new Transition("active", (job) => job.properties.get("welcomeSent") === true),
        ]),
        new State("active"),
    ],
    "new",
    [name, email, welcomeSent],
);

const job = await onboarding.startJob(new Map([["name", "Ada"], ["email", "ada@example.com"]]));
```

The job starts in `new`. When it is processed the `sendWelcome` action runs and
sets `welcomeSent`, and the transition then advances the job to `active`. Run
locally this happens automatically in memory; deployed, it happens on the
platform.

## Command-line interface

The [`anbaric`](https://npmjs.com/package/anbaric-cli) CLI authenticates a
terminal, deploys applications, and inspects and drives jobs on a platform. The
principal commands are:

| Command | Purpose |
| --- | --- |
| `anbaric login` / `anbaric logout` | authorize this terminal against a platform, or revoke it |
| `anbaric apps` | list deployed applications |
| `anbaric app configure` | set an application's name and internal port |
| `anbaric app deploy` | deploy an application and wait until it is live |
| `anbaric app update` | deploy over a running application without prompting |
| `anbaric app status <name>` | show an application's deploy state and whether it is up |
| `anbaric app tail <name>` | stream an application's runtime logs |
| `anbaric app tear-down <name>` | stop and remove a deployed application |
| `anbaric state-machines` | list registered state machines |
| `anbaric jobs list [state-machine-id]` | list jobs |
| `anbaric jobs watch <job-id>` | follow a job's state as it changes |
| `anbaric jobs set-state <job-id> <state>` | move a job to a state and re-queue it |
| `anbaric jobs update <job-id> <key=value ...>` | change job properties and re-queue |

The `app configure`/`deploy`/`update` commands act on the application for the
current project, located by walking up to the nearest `package.json`, so they
run from anywhere inside it.

Every command accepts flags (such as `--environment`, `--tenant`, `--name`,
`--port`, `--yes`) that supply the answers a prompt would otherwise ask for, so
the CLI can be run non-interactively in scripts and CI. See the
[`anbaric-cli`](https://npmjs.com/package/anbaric-cli) documentation for the
full command and flag reference.

## Packages

`anbaric` re-exports these packages; install them individually for a narrower
dependency.

- [`anbaric-tsapi`](https://npmjs.com/package/anbaric-tsapi) — the interfaces
  and value classes: `Job`, `State`, `Action`, `Transition`, `Actor`,
  `JobPersistence`, `JsonStore`, `SecretStore`, `Auditor`.
- [`anbaric-state-machine`](https://npmjs.com/package/anbaric-state-machine) —
  the `StateMachine`, actors, and in-memory implementations.
- [`anbaric-data-store`](https://npmjs.com/package/anbaric-data-store) — the
  document and secret stores.
- [`anbaric-impl-cloud`](https://npmjs.com/package/anbaric-impl-cloud) — the
  clients used when an application is deployed to a platform.
- [`anbaric-cli`](https://npmjs.com/package/anbaric-cli) — the platform CLI.
- [`anbaric-hosting`](https://npmjs.com/package/anbaric-hosting) — run a
  platform yourself.
