# Anbaric

Build custom back-office software from the ground up in minutes, not months.
An Anbaric app is a plain Node/TypeScript program that models its work as
**state machines**: jobs move through states, actions run when a job is
processed, and transitions decide where it goes next. Run it on your laptop
with zero setup, then deploy the same code unchanged to an Anbaric platform.

This README is for app developers. If you're working on the platform itself,
start with `CLAUDE.md` and the package READMEs.

## Write an app

```ts
import {Action, PropertyDefinition, State, Transition} from "anbaric-tsapi";
import {Code, StateMachine} from "anbaric-state-machine";

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
(schema-validated documents) and `SecretStoreFactory` (encrypted secrets) from
`anbaric-data-store`.

If your app serves HTTP, listen on `process.env.PORT` and users reach it at
`<platform>/<app-name>`. All front-end must be React and use the Anbaric
design system (`anbaric-design-system`) — see the living style guide by
opening `anbaric-design-system/dist/index.html`.

## Run it locally

```bash
npx tsx src/main.ts
```

That's it — jobs live in memory and progress automatically via the local
consumer. Nothing to install or configure.

## Deploy it

```bash
anbaric login                 # pick a platform; a browser authorizes this terminal
anbaric configure             # writes .anbaric/app-config.json (name + internal port)
anbaric deploy                # packs, uploads, bakes an image, waits until live
```

`deploy` returns when the app is actually answering on its port. Watch it
work with `anbaric apps`, `anbaric job list [state-machine]`, and
`anbaric job watch <job-id>`.

### What deployment does (and expects)

The platform unpacks your upload onto a pre-canned base image, links the
`anbaric-*` libraries, bakes a Docker image and runs it as a container. Note
carefully what it does **not** do:

- **No build step.** `npm run build` is never run — your TypeScript source is
  executed directly (via tsx). Ship source, not `dist/`.
- **No dependency install.** `npm install` is never run. Only `anbaric-*`
  dependencies are available (the platform links them in); other npm
  dependencies are not yet supported in deployed apps.

An app must have:

- `package.json` with `main` pointing at the entry file (e.g. `src/main.ts`)
  and `"type": "module"`.
- `.anbaric/app-config.json` with a `name` (lowercase letters, numbers, `-`,
  `_`) and an `internalPort` — `anbaric configure` creates it, and `deploy`
  prompts if it's missing.
- An HTTP listener on `process.env.PORT` (deploy waits for it to respond).

The platform injects all wiring as env vars (`ANBARIC_*_TYPE=cloud`, the
platform URL, consumer ports) — never hardcode these.

## CLI reference

| Command | Purpose |
| --- | --- |
| `anbaric login` | choose a platform and authorize this terminal (browser flow; keypair saved to `~/.anbaric/`) |
| `anbaric configure [dir]` | create or update `.anbaric/app-config.json` |
| `anbaric deploy [dir]` | deploy an app (prompts before replacing a running one) |
| `anbaric update [dir]` | deploy, replacing without prompting |
| `anbaric apps` | list deployed apps |
| `anbaric state-machines` | list registered state machines |
| `anbaric job list [state-machine-id]` | list jobs |
| `anbaric job watch <job-id>` | follow a job's state live |
| `anbaric job set-state <job-id> <state>` | move a job and re-queue it |
| `anbaric job update <job-id> <key=value ...>` | update job properties and re-queue |

All commands accept `--platform-url` and `--tenant`; `login` sets the
defaults. Manage your CLI keys in the browser at `<platform>/manage-keys`.

## Run a platform locally

```bash
cd gitops/local
tofu init && tofu apply       # Docker Desktop: Postgres + the platform on :8787
```

See `gitops/README.md` for staging/prod and for enabling Auth0 login.
`sample-apps/crm` is a complete worked example — deploy it with
`anbaric deploy sample-apps/crm`.
