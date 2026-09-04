# Core concepts

Anbaric gives you a small set of building blocks. Once these click, everything
else in the guide is a variation on them.

## The mental model

An application is one or more **state machines**. Each machine describes a
process as a set of named **states** with **transitions** between them. A running
instance of that process is a **job** — it holds your data as **properties** and
sits in one state at a time.

```
        ┌── action ──┐        transition           ┌── action ──┐
 start ─┤  new       ├──── (welcomeSent) ────▶  active         │
        └────────────┘                              └────────────┘
   a Job lives here, carrying properties like { name, email, welcomeSent }
```

When a job is processed, Anbaric runs the current state's **actions** (which
propose changes to the job's properties), then evaluates its **transitions**
(the first one whose condition holds moves the job on). This repeats until the
job reaches a state where nothing more applies — often a **terminal** state.

## The pieces

| Concept | What it is |
| --- | --- |
| **`StateMachine`** | A workflow: an id, its states, the start state, and the property schema for its jobs. |
| **`State`** | A named step. Holds the actions that run while a job sits in it and the transitions out of it. |
| **`Action`** | A unit of work. Its `run(job)` returns a map of property changes — it never mutates the job directly. |
| **`Await`** | A pause point in a state's actions. Parks the job until a person or system provides input. |
| **`Transition`** | A target state plus a predicate over the job. The first satisfied transition wins. |
| **`Job`** | One instance moving through a machine: its `properties`, its current `state`, and its history. |
| **`PropertyDefinition`** | The schema for one property a job may carry: whether it's required and how it's validated. |
| **`Actor`** | Who is performing an operation — `Code`, `Human`, `Agent` or `System` — recorded for auditing and authorization. |

## Properties are data; the machine owns the writes

Your job's data lives in its `properties` (a `Map`). Actions don't set properties
directly — they **return** the changes they want, and the machine validates them
against your schema before applying them. Every property a job holds must have a
`PropertyDefinition`, or the change is rejected. This is what keeps a job's data
trustworthy no matter who or what wrote it.

## Nothing is hard-wired

Persistence, queueing, document/secret/SQL stores — all of them come from
**environment-driven factories**. With no configuration you get fast in-memory
implementations and the whole app runs in one process. Deployed, the same
factories talk to the platform. **You never change your code between the two.**

```ts
// This line works identically locally and in the cloud:
const machine = new StateMachine("onboarding", states);
```

## Everything is audited

Every write to a job, document, secret or the SQL store is attributed to the
**actor** that made it — which is why store methods take an actor. You get a
full trail of who created a job, every state change, and who caused it, for free.

## Where to go next

- [State machines](state-machines.md) — define and run your first workflow
- [Actions and actors](actions-and-actors.md) — the three kinds of doer
- [Build your first app](../patterns/first-app.md) — put it all together
