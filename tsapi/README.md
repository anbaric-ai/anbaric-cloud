# anbaric-tsapi

The contracts and value classes shared by every Anbaric package. Nothing
here depends on any other Anbaric package. App developers usually install
[`anbaric`](https://npmjs.com/package/anbaric) instead, which re-exports all
of this.

Interfaces whose implementations may cross a process boundary are async:
their methods return `Promise` even when an implementation is trivially
synchronous.

## Value classes

**`Job`** — a unit of work moving through a workflow.
`new Job(id, properties = new Map(), initialState, workflowId?, startedBy = "system", startedAt = new Date(), lastUpdated = startedAt, transitions = [])`.
`stateId` is a getter; state only changes through
`transition(transition, actor = workflowId ?? "state-machine")`, which
records `{from, to, actor}` into `transitions` and bumps `lastUpdated` when
the transition's predicate accepts the job.

**`State`** — `new State(id, actions = [], transitions = [])`, plus
`subscribe(action)` to add an action later.

**`Action`** — `new Action(name, actor, description = "", id = crypto.randomUUID())`.
Two replaceable function fields: `predicate : (job) => boolean` (defaults to
accept) gates whether the action runs, and
`run : (job) => Promise<Map<string, any>>` (defaults to an empty map)
returns the property changes the action wants. `run` never mutates the job.

**`Actor`** — an interface, pure identity: `{ type : "HUMAN" | "CODE" | "AGENT", id : string, role : string }`.
Concrete `Human`, `Code`, `Agent` classes live in `anbaric-state-machine`.

**`Transition`** — `new Transition(to, predicate)`; the first accepting
transition in a state wins.

**`PropertyDefinition`** — `new PropertyDefinition(id)` with mutable
`required : boolean` (default false) and `validation : (value) => boolean`
(default accept).

**`JobTransition`** — `{ from : string, to : string, actor : string }`.

**Serialization** — `serializeJob(job) : SerializedJob` and
`deserializeJob(serialized) : Job` define the wire shape used by the cloud
clients and platform (dates as ISO strings, properties as a plain object).

## Contracts

**`JobPersistence`** — `save(job)`, `retrieve(id)` (throws
`No job found with id "x"`), `delete(id)`, `list(pageSize = 100, page = 0)`,
`updateProperties(id, properties)` (merge; implementations stamp
`lastUpdated`).

**`Queue`** — `enqueue(jobId, workflowId)`, `schedule(jobId, workflowId, due)`.
**`Dequeue extends Queue`** adds `dequeueSome() : Promise<Array<QueueMessage>>`;
the exported `Dequeue.supports(queue)` type guard tests for it structurally.
Delivery is at-least-once: consumers must tolerate redelivery.

**`Consumer`** — `subscribe(workflowId, processJob)` routes deliveries for
one workflow to a callback; `cleanUp()` releases resources.

**`JsonStore`** — `save(id, document)`, `retrieve(id)`, `delete(id)`,
`list()`; implementations validate against a `JsonSchema` when one is given.

**`SecretStore`** — `save(name, value)`, `retrieve(name)`, `list()`.

**`QueueMessage`** — `{ jobId, workflowId }`; part of the platform's private
wire protocol (in `api/cloud/`), exported because `Dequeue` returns it.
