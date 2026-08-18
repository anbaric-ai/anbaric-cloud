# anbaric-tsapi

The contracts and value classes shared by every Anbaric package. Nothing
here depends on any other Anbaric package. App developers usually install
[`anbaric`](https://npmjs.com/package/anbaric) instead, which re-exports all
of this.

Interfaces whose implementations may cross a process boundary are async:
their methods return `Promise` even when an implementation is trivially
synchronous.

## Value classes

**`Job`** — a unit of work moving through a workflow. Immutable.
`new Job(id, properties = new Map(), state, workflowId?, startedBy = "system", startedAt = new Date(), lastUpdated = startedAt)`.
`state` is a readonly string; a job never changes in place — `JobPersistence.save`
constructs a new `Job` at the target `state` and stamps `lastUpdated`.

**`State`** — `new State(id, actions = [], transitions = [])`, plus
`subscribe(action)` to add an action later.

**`Action`** — `new Action(name, actor, description = "", id = crypto.randomUUID())`.
Two replaceable function fields: `predicate : (job) => boolean` (defaults to
accept) gates whether the action runs, and
`run : (job) => Promise<Map<string, any>>` (defaults to an empty map)
returns the property changes the action wants. `run` never mutates the job.

**`Actor`** — an interface, pure identity: `{ type : "HUMAN" | "CODE" | "AGENT" | "SYSTEM", id : string, role : string }`.
Concrete `Human`, `Code`, `Agent` classes live in `anbaric-state-machine`.

**`Transition`** — `new Transition(to, predicate)`; the first accepting
transition in a state wins.

**`PropertyDefinition`** — `new PropertyDefinition(id)` with mutable
`required : boolean` (default false) and `validation : (value) => boolean`
(default accept).

**Serialization** — `serializeJob(job) : SerializedJob` and
`deserializeJob(serialized) : Job` define the wire shape used by the cloud
clients and platform (dates as ISO strings, properties as a plain object).

## Contracts

**`JobPersistence`** — an abstract class taking an `Auditor`; every method takes
the acting `Actor` and audits before deferring to an abstract `…Internal`.
`create(actor, job)`, `save(actor, changeDescription, job, properties?, state?)`
(applies the property/state change and stamps `lastUpdated`),
`retrieve(id, actor)` (throws `No job found with id "x"`), `delete(id, actor)`,
`list(actor, pageSize?, page?)`.

**`Queue`** — `enqueue(jobId, workflowId)`, `schedule(jobId, workflowId, due)`.
**`Dequeue extends Queue`** adds `dequeueSome() : Promise<Array<QueueMessage>>`;
the exported `Dequeue.supports(queue)` type guard tests for it structurally.
Delivery is at-least-once: consumers must tolerate redelivery.

**`Consumer`** — `subscribe(workflowId, processJob)` routes deliveries for
one workflow to a callback; `cleanUp()` releases resources.

**`JsonStore`** — abstract, `Auditor`-backed and actor-audited like
`JobPersistence`: `create(actor, id, document)`,
`save(actor, changeDescription, id, document)`, `retrieve(id, actor)`,
`delete(id, actor)`, `list(actor, pageSize?, page?)` (returns the document
values, not ids); implementations validate against a `JsonSchema` when one is given.

**`SecretStore`** — abstract, `Auditor`-backed: `create(actor, name, value)`,
`save(actor, changeDescription, name, value)`, `retrieve(name, actor)`,
`delete(name, actor)`, `list(actor)`. Secret values never appear in audit details.

**`QueueMessage`** — `{ jobId, workflowId }`; part of the platform's private
wire protocol (in `api/cloud/`), exported because `Dequeue` returns it.
