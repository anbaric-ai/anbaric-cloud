# Anbaric

Anbaric is a TypeScript framework for building stateful enterprise applications. Anbaric is designed to help vibe-coded applications go the last mile, by providing persistence, state management, authentication and auditing.

We believe that fully bespoke software is the future, and this project was created to help a wider range of people build their own solutions, without compromising enterprise IT standards.

## Getting started

Install the Anbaric package and the CLI:

```bash
npm init
npm install anbaric
npm install -g anbaric-cli
```

Prompt your agent:

```
Use Anbaric to build me a CRM.
```

Run locally as usual (`npm run start`) or deploy to the Anbaric Cloud (`anbaric app deploy`).

Anbaric is open source and you can self-host the platform or sign up at https://cloud.anbaric.ai to use the hosted version.

## Documentation

A full user guide — split into **features**, **patterns** and **API reference**
(TypeScript and web) — lives in [`anbaric/docs`](anbaric/docs/README.md). Start
with [Core concepts](anbaric/docs/features/core-concepts.md), then the
[Build your first app](anbaric/docs/patterns/first-app.md) walkthrough.

## What the code looks like

Anbaric has a collection of features that can be used in your application. Here are some examples:

### Persist JSON

In this example we will store a customer's details in a JSON document. Every change that is made in Anbaric requires an `Actor` to be specified, which is used to ensure a complete audit trail exists for any application built using Anbaric. In general, an actor will be either a "human" actor, an AI agent or code being executed by the system.

When your app serves a page to a signed-in user, `Human.fromSession` turns that request into the human actor behind it — it resolves the browser's platform session (the `anbaric_session` cookie) against the platform, so the audit trail names the real user. Pass it the incoming request (or the session token directly). Outside a request — a seed script or system code — construct the actor yourself, e.g. `new Human("ada", ["admin"])` or a `Code` actor.

```ts
import {Human, JsonStoreFactory} from "anbaric";

// inside your app's HTTP handler, `request` is the incoming browser request
const actor = await Human.fromSession(request);
const customers = JsonStoreFactory.instance("customers");

await customers.create(actor, "ada", { name: "Ada Lovelace", email: "ada@example.com" });
const ada = await customers.retrieve("ada", actor);
```

### Run a state machine

A state machine models work as jobs moving through named states. Actions run while a job sits in a state, and transitions decide where it goes next. A state machine can combine steps using different types of actors, so humans can own some action, AI agents and code can automate others.

```ts
import {Action, Code, PropertyDefinition, State, StateMachine, Transition} from "anbaric";

const sendWelcome = new Action("Send welcome email", new Code("welcome"));
sendWelcome.run = async (job) => {
    // Access properties stored against the job
    const email = job.properties.get("email");
    // Run some code
    console.log(`Sending welcome email to ${email}`);
    // Return new properties to add to the job
    const newProperties = new Map();
    newProperties.set("emailSent", true);
    return newProperties;
};

const onboarding = new StateMachine("onboarding", [
    new State("new", [sendWelcome], [new Transition("active", (job) => job.properties.get("emailSent") === true)]),
    new State("active"),
]);

const customer = await onboarding.startJob(new Map([["email", "ada@example.com"]]));
```

The job starts in `new`; when it is processed the action runs, sets `emailSent`, and the transition advances it to `active`.

### Using AI agents to automate states

An **agent** is an actor whose properties are produced by a model rather than by
hand-written code. A `RemoteLLMAgenticAction` gives the agent a prompt and a JSON
Schema, and applies the properties it returns to the job. Here an OpenAI-backed
agent triages a support ticket:

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
    new State("open", [triage], [new Transition("prioritised", (job) => job.properties.has("priority"))]),
    new State("prioritised"),
]);
```

Because the agent is just another actor, its work is audited like any other —
the triage decision is attributed to `triager`.

### Wait for human input

Sometimes a job cannot progress by itself — it needs a person to approve
something, fill in a form, or make a decision. An **`Await`** is a step in a
state's action list that *pauses* the job instead of running: when a job reaches
it, the job is parked in the **`Awaiting input`** status and is not processed
again until its properties are updated. Point people at wherever they provide
that input with a **`resolveUrl`** — a function of the job, so you can build a
per-job link with the job id (and anything else) in the query string.

Here an order waits for a human to approve it. The app serves a small approval
UI at `/approve` (any framework — the page itself is omitted here); it reads the
job id from the query string, collects the decision, and calls
`updateJob(jobId, { approved: true }, actor)`. The `Await` sends the reviewer
there, and a transition moves the job on once `approved` is set:

```ts
import {Await, State, StateMachine, Transition} from "anbaric";

const approve = new Await("Approve the order", "HUMAN");
approve.fields = ["approved"];                                  // the input we expect back
approve.resolveUrl = (job) => `/approve?job=${job.id}`;         // where the human provides it

const fulfilment = new StateMachine("fulfilment", [
    new State("review", [approve], [new Transition("approved", (job) => job.properties.get("approved") === true)]),
    new State("approved"),
]);

const order = await fulfilment.startJob(new Map([["total", 4200]]));
// The job reaches `approve`, parks in "Awaiting input", and waits.
// When the approval UI calls updateJob(order.id, { approved: true }, actor),
// the job resumes, the transition fires, and it advances to `approved`.
```

The pause is recorded in the audit trail, and the [awaiting-input
widget](#the-admin-console-and-widgets) lists every parked job — with a
clickable `resolveUrl` for those awaiting a human. Pass `"EXTERNAL_SYSTEM"`
instead of `"HUMAN"` when the input will come from another service rather than a
person.

### Use an RDBMS

A full relational store is available for structured data. Locally it is SQLite; deployed, it is the tenant's PostgreSQL.

```ts
import {Human, SqlStoreFactory} from "anbaric";

const actor = new Human("ada", "admin");
const sql = SqlStoreFactory.instance();

await sql.execute(actor, "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT)");
await sql.execute(actor, "INSERT INTO notes (body) VALUES (?)", ["hello"]);
const rows = await sql.query(actor, "SELECT id, body FROM notes");
```

### Serve a web UI

An app can serve its own HTTP frontend. Listen on `process.env.PORT` and the
platform's app proxy serves it at `<platform>/app/<name>/*`, stripping the
`/app/<name>` prefix before the request reaches your app — combine it with the
persistence and state-machine APIs above to put your data on a page. See
[Web APIs](anbaric/docs/api/web.md) for the full proxy contract (forwarded
headers, the absolute-URL caveat).

```ts
import {createServer} from "node:http";

createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<h1>My Anbaric app</h1>");
}).listen(Number(process.env.PORT ?? 3000));
```

Serve trivial pages directly like this; build richer UIs with React and the
Anbaric design system (`anbaric-design-system`). `sample-apps/crm` is a complete
worked example — an HTTP server that renders its customers as HTML and exposes a
JSON API backed by a state machine.

## Auditing

Every write to a job, document, secret or the SQL store is recorded against the
actor that made it — which is why the store methods take an actor. An audit
record captures the actor, the resource, the interaction (create, update, state
change, delete, kill…) and a short description. Locally the records print to the
console; deployed, the platform persists them and they are browsable in the
admin console. Reads and lists can be audited too, but the platform masks them
by default to keep the volume down.

## Using the CLI

`anbaric-cli` authorizes your terminal against a platform, deploys apps, and
inspects and drives their jobs. After a one-time `anbaric login` (a browser
flow), a typical loop is:

```bash
anbaric app deploy            # deploy the current project and wait until it is live
anbaric jobs list             # list jobs and their states
anbaric jobs watch <job-id>   # follow a job as it progresses
anbaric jobs stats            # counts per state and the queue depth
```

Every interactive prompt also has a flag, so the CLI runs unattended in scripts
and CI. The full command list is in the [CLI reference](#cli-reference) below.

## The Admin console and widgets

The platform serves an admin console at its root — a dashboard assembled from
**plugins**. The built-in `anbaric-plugins/state-machines` plugin lists your
state machines and their jobs. You add your own pages and widgets by writing a
small plugin — a `pages`/`widgets` object — and naming it in `ANBARIC_PLUGINS`.
Widgets are React components, optionally backed by a server-side data function,
rendered with the platform's design system. See
[`anbaric-plugins`](anbaric-plugins/README.md).

## State machine deep-dive

A **`StateMachine`** is constructed from a workflow id, its `State`s, the start
state, and the property schema for its jobs. A **`State`** holds the **actions**
that run while a job sits in it and the **transitions** to other states. An
**`Action`** has a `run` function returning the property changes to apply — it
never mutates the job directly. A **`Transition`** names a target state and a
predicate; the first transition whose predicate holds moves the job. A **`Job`**
is one instance moving through the machine, carrying its `properties`, its
current `state`, and its history. A state can be marked terminal (or use the
`Terminal` helper, which carries a `SUCCESS`/`FAILURE` outcome); a job that
reaches one stops and is not processed again.

Every action also declares the **actor** it runs as (`Code`, `Human` or
`Agent` — pure identity objects), recorded for auditing and authorization.
There are three ways to influence a job:

1. **Update it directly**, declaring who is acting:
   `machine.updateJob(jobId, new Map([["approved", true]]), new Human("chris", "manager"))`.
2. **Execute an action directly** — the actor is embedded in the action:
   `machine.executeAction(jobId, approveAction)`.
3. **Subscribe an action to a state** — pass it in the `State` constructor or
   call `state.subscribe(action)`, and it runs (predicate permitting)
   whenever a job is processed in that state.

Whichever way, property changes are schema-validated and audited, and each
job carries its history: who started it, every from→to transition and the
actor that made it.

A state's action list may also contain an **`Await`** — a pause point rather
than an actor acting. When a job reaches one it stops running actions and is
parked: its `status` becomes `Awaiting input` (distinct from its `state`), and
it holds a **`WaitForInput`** describing what is expected — the `fields`, a
resolved `resolveUrl`, whether a `HUMAN` or `EXTERNAL_SYSTEM` is expected, and
any metadata the `Await` computed for the job. A parked job is not re-processed
until an `updateJob` arrives; on resume it skips its actions and only
re-evaluates its transitions, so the input drives it on and the wait clears once
it moves to another state. Actions placed after an `Await` in the same state do
not run when the job resumes.

Everything is pluggable through env-driven factories: locally (no env vars)
you get in-memory persistence and queueing; deployed, the same factories talk
to the platform automatically. The same applies to `JsonStoreFactory`
(schema-validated documents), `SecretStoreFactory` (encrypted secrets) and
`SqlStoreFactory` (a relational store) from `anbaric-data-store`.

The SQL store is backed by SQLite locally (in-memory by default) and, once
deployed, by the tenant's PostgreSQL in a schema named after your app — its own,
isolated from every other app in the tenant. Write portable SQL where you can — the two
differ in a few places, notably parameter placeholders (`?` for SQLite, `$1`
for PostgreSQL); see the [`anbaric-data-store`](anbaric-data-store/README.md)
docs for the full list.

If your app serves HTTP, listen on `process.env.PORT` and users reach it at
`<platform>/app/<name>`. All front-end must be React and use the Anbaric
design system (`anbaric-design-system`) — see the living style guide by
opening `anbaric-design-system/dist/index.html`.

## Run it locally

With no `ANBARIC_*` variables set, the factories return the in-memory
persistence, queue and stores, so the program runs entirely in-process — no
database or platform involved. Run the TypeScript entry file directly with tsx;
`npx` fetches it on demand if your project doesn't already depend on it:

```bash
npx tsx src/main.ts
```

Jobs are held in memory and progress as the in-memory consumer delivers them;
the state is gone when the process exits. This is the mode for development and
tests.

## Deploy it

```bash
npm install -g anbaric-cli    # once; provides the anbaric command
anbaric login                 # pick a platform; a browser authorizes this terminal
anbaric app configure         # writes .anbaric/app-config.json (name + internal port)
anbaric app deploy            # packs, uploads, bakes an image, waits until live
```

`app deploy` returns once the app is actually up — its built-in admin port
answers the platform's liveness ping. Watch it
work with `anbaric apps`, `anbaric jobs list [state-machine]`, and
`anbaric jobs watch <job-id>`. The `app` commands run from anywhere inside the
project — they walk up to the nearest `package.json`.

### What deployment does (and expects)

The platform unpacks your upload onto a pre-canned base image, installs the
app's dependencies, bakes a Docker image and runs it as a container. One thing
it does **not** do:

- **No build step.** `npm run build` is never run — your TypeScript source is
  executed directly (via tsx). Ship source, not `dist/`.

Dependencies, though, *are* installed: the image runs `npm install` for the
app's declared dependencies (the `anbaric-*` packages and any others), so
ordinary npm dependencies work. Only source is uploaded — `node_modules` is
not.

An app must have:

- `package.json` with `main` pointing at the entry file (e.g. `src/main.ts`)
  and `"type": "module"`.
- `.anbaric/app-config.json` with a `name` (lowercase letters, numbers, `-`,
  `_`) and an `internalPort` — `anbaric app configure` creates it, and
  `app deploy` prompts if it's missing.

A built-in admin process answers the platform's liveness check, so an app needs
no HTTP server of its own to deploy. If it does serve HTTP (reached through the
app proxy), it listens on `process.env.PORT`. The platform injects all wiring as
env vars (`ANBARIC_*_TYPE=cloud`, the platform URL, the consumer and admin
ports) — never hardcode these.

## CLI reference

| Command | Purpose |
| --- | --- |
| `anbaric login` | choose a platform and authorize this terminal (browser flow; keypair saved to `~/.anbaric/`) |
| `anbaric apps` | list deployed apps |
| `anbaric app configure` | create or update `.anbaric/app-config.json` |
| `anbaric app deploy` | deploy the app (prompts before replacing a running one) |
| `anbaric app update` | deploy, replacing without prompting |
| `anbaric app status <name>` | show an app's deploy state and whether it is up |
| `anbaric app tail <name>` | stream an app's runtime logs |
| `anbaric app tear-down <name>` | stop and remove a deployed app |
| `anbaric state-machines` | list registered state machines |
| `anbaric jobs create <sm-id> <start-state> [k=v ...]` | create a job and queue it for processing |
| `anbaric jobs list [state-machine-id]` | list jobs |
| `anbaric jobs stats` | job counts per state and the queue size |
| `anbaric jobs watch <job-id>` | follow a job's state live |
| `anbaric jobs set-state <job-id> <state>` | move a job and re-queue it |
| `anbaric jobs update <job-id> <key=value ...>` | update job properties and re-queue |
| `anbaric jobs kill <job-id>` | kill a job so it stops progressing |
| `anbaric jobs kill-old <age>` | kill jobs not updated within `<age>` (e.g. `24h`, `7d`) |

All commands accept `--platform-url` and `--tenant`; `login` sets the
defaults. Manage your CLI keys in the browser at `<platform>/manage-keys`.

## Packages

`anbaric` is the umbrella install for writing an application — it re-exports the
app-facing surface of the packages below. Install them individually for a
narrower dependency.

- [`anbaric-tsapi`](https://npmjs.com/package/anbaric-tsapi) — the interfaces
  and value classes: `Job`, `State`, `Action`, `Await`, `Transition`, `Actor`,
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

Applications should not set the `ANBARIC_*` factory variables themselves; the
platform sets them when the application is deployed, so the same code runs
in-memory locally and platform-backed once deployed.

## Run your own platform

`npm install -g anbaric-hosting` provides the full hosting service - API,
dispatcher, build layers and proxy - bootable with the `anbaric-hosting`
command and configured entirely through `ANBARIC_*` environment variables.

## Run a platform locally

```bash
cd gitops/local
tofu init && tofu apply       # Docker Desktop: Postgres + the platform on :8787
```

See `gitops/README.md` for staging/prod and for enabling Auth0 login.
`sample-apps/crm` is a complete worked example — deploy it by running
`anbaric app deploy` from inside `sample-apps/crm`.
