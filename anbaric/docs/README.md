# Anbaric user guide

Everything you need to build a real application on Anbaric — from your first
state machine to a deployed app with a human-in-the-loop workflow, a database, a
web UI and an audit trail.

Anbaric models an application as one or more **state machines**: long-lived
**jobs** move through named **states**, driven by **actions** and **transitions**,
with their data validated against a schema and every change recorded. The same
code runs in-memory on your laptop and platform-backed once deployed — you never
write deployment details into your app.

New here? Read [Core concepts](features/core-concepts.md), then work through the
[Build your first app](patterns/first-app.md) walkthrough.

## Features

What the framework gives you, one capability at a time.

- [Core concepts](features/core-concepts.md) — jobs, states, actions, transitions, actors
- [State machines](features/state-machines.md) — defining and running a workflow
- [Actions and actors](features/actions-and-actors.md) — who does the work, and how
- [Awaiting input](features/awaiting-input.md) — pausing a job for a human or external system
- [Scheduled runs](features/scheduled-runs.md) — starting jobs on a timetable
- [AI agents](features/ai-agents.md) — letting a model drive a state
- [Documents and secrets](features/documents-and-secrets.md) — the JSON and secret stores
- [The SQL store](features/sql-store.md) — a relational database for structured data
- [Auditing](features/auditing.md) — the record of who changed what
- [Entitlements](features/entitlements.md) — what a user has been granted, checked per request
- [Prompts](features/prompts.md) — versioned model instructions and schemas, saved at startup
- [Serving a web UI](features/serving-a-web-ui.md) — putting your data on a page
- [The admin console and widgets](features/admin-console-and-widgets.md) — dashboards and plugins
- [Deploying](features/deploying.md) — from laptop to Anbaric Cloud

## Patterns

How to put the features together to build something real.

- [Build your first app](patterns/first-app.md) — an end-to-end walkthrough
- [Structuring an application](patterns/app-structure.md) — files, entry point, wiring
- [Modelling a workflow](patterns/modelling-workflows.md) — turning a process into states
- [Human-in-the-loop](patterns/human-in-the-loop.md) — approvals, forms and hand-offs
- [Integrating external systems](patterns/integrating-external-systems.md) — waiting on callbacks and webhooks
- [Authorization with actors and roles](patterns/authorization.md) — who is allowed to do what
- [UX practices](patterns/ux-practices.md) — feedback and polling for an asynchronous UI
- [Testing your app](patterns/testing.md) — driving a machine in memory

## API reference

The surface you build against.

- [TypeScript API](api/typescript.md) — the full app-facing library
  - [State machines](api/state-machine.md) — `StateMachine`, `State`, `Action`, `Await`, `Transition`, `Job`, `PropertyDefinition`
  - [Actors and agents](api/actors-and-agents.md) — `Code`, `Human`, `Agent`, AI actions
  - [Stores](api/stores.md) — `JsonStore`, `SecretStore`, `SqlStore` and their factories
  - [Environment and factories](api/environment.md) — the `ANBARIC_*` variables
- [Web APIs](api/web.md) — serving HTTP, the app proxy, and the platform endpoints you call
- [CLI reference](api/cli.md) — the `anbaric` command

---

Everything in this guide is app-author-facing: the public library, the CLI and
the web surface. You never need to know how the platform is built to build on it.
