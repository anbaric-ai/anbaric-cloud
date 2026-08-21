# Anbaric

Anbaric is a TypeScript framework for building stateful back-office
applications, together with a platform for deploying them. An app is a plain
Node/TypeScript program that models its work as **state machines**: jobs move
through named states, actions run when a job is processed, and transitions
decide which state a job moves to next. The same program runs against in-memory
implementations on your machine and against a platform's Postgres, queue and
stores once deployed — the application code does not change between the two.

This README is for app developers. If you're working on the platform itself,
start with `CLAUDE.md` and the package READMEs.

## Write an app

Everything an app needs comes from one install:

```bash
npm install anbaric
```

```ts
import {Action, Code, PropertyDefinition, State, StateMachine, Transition} from "anbaric";

const sendWelcome = new Action("Send welcome email", new Code("send-welcome"));
sendWelcome.run = async (job) => new Map([["welcomeSent", true]]);

const customers = new StateMachine(
    "customer-onboarding",
    [
        new State("new", [sendWelcome], [new Transition("active", job => job.properties.get("welcomeSent") === true)]),
        new State("active"),
    ],
    "new",
    [new PropertyDefinition("email"), new PropertyDefinition("welcomeSent")],
);

const customer = await customers.startJob(new Map([["email", "ada@example.com"]]));
```

Every action declares an **actor** (`Code`, `Human` or `Agent` — pure
identity objects) and a `run` function returning the properties it wants to
set. There are three ways to influence a job:

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

Everything is pluggable through env-driven factories: locally (no env vars)
you get in-memory persistence and queueing; deployed, the same factories talk
to the platform automatically. The same applies to `JsonStoreFactory`
(schema-validated documents), `SecretStoreFactory` (encrypted secrets) and
`SqlStoreFactory` (a relational store) from `anbaric-data-store`.

The SQL store is backed by SQLite locally (in-memory by default) and, once
deployed, by the tenant's PostgreSQL in a dedicated `anbaric_app_data` schema
shared by all of the tenant's apps. Write portable SQL where you can — the two
differ in a few places, notably parameter placeholders (`?` for SQLite, `$1`
for PostgreSQL); see the [`anbaric-data-store`](anbaric-data-store/README.md)
docs for the full list.

If your app serves HTTP, listen on `process.env.PORT` and users reach it at
`<platform>/<app-name>`. All front-end must be React and use the Anbaric
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
