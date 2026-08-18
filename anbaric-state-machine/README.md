# anbaric-state-machine

The public state machine library: the `StateMachine` itself, the concrete
actors, the auditor, and in-memory implementations of the
[`anbaric-tsapi`](https://npmjs.com/package/anbaric-tsapi) contracts. App
developers usually install [`anbaric`](https://npmjs.com/package/anbaric),
which re-exports this package.

## StateMachine

```ts
new StateMachine(workflowId, states, startState, dataSchema,
    persistence = JobPersistenceFactory.instance(),
    queue = QueueFactory.instance())
```

Construction subscribes a consumer (`ConsumerFactory.instance(queue)`) to
the workflow, so jobs progress automatically whenever the queue delivers
them. `cleanUp()` releases the consumer.

**`startJob(properties?, actor?) : Promise<Job>`** — validates the
properties (every key must be in the schema and pass its validation;
`required` definitions must be present), persists the job and enqueues it.
`startedBy` is the actor's id, or the workflowId when no actor is given.
Throws `Invalid properties` / `Unauthorized`.

**`updateJob(jobId, properties, actor) : Promise<void>`** — explicit change
with a declared actor. Validates (required-ness is not re-checked on
update), merges the changed properties through `save` (which audits
`Properties updated`), re-enqueues.

**`executeAction(jobId, action) : Promise<void>`** — runs one action now,
its embedded actor as the responsible party. Refuses when the action's
predicate rejects the job (`Action predicate unmet`) or when the returned
properties fail the schema (`The action generated invalid properties`).
Persists the returned properties and re-enqueues.

**Progression** (internal, driven by the consumer): for the job's current
state, every action whose `predicate` accepts the job is run; each returned
property map is schema-validated (invalid output is discarded and audited,
not applied) and merged into the job. Then transitions are evaluated in
order — the first whose predicate accepts wins, at most one per progression,
and transitions to undefined states are skipped. The transition is recorded
in the job's history with the workflow as actor. Only when something
actually changed is the job saved and re-enqueued — so multi-state flows
chain automatically and an unchanged progression is a no-op. All changes are
audited through a transaction flushed at the end.

## Actors

`Code` and `Human` implement the `Actor` interface as pure identity objects:
`new Code(id, role = "code")`, `new Human(id, role)`. An `Agent` is an actor
too, but carries a `Client` for its model calls — construct a concrete
`OpenAIAgent` (or `AnbaricServicesAgent` from `anbaric-services-client`) rather
than a bare agent. Behaviour never lives on a plain actor — an `Action`'s
`run` field carries the code, the actor says who is responsible.

## Auditing

`AuditorFactory.instance()` returns the configured `Auditor` (a `ConsoleAuditor`
by default, a `CloudAuditor` when `ANBARIC_AUDITOR_TYPE=cloud`). Its
`audit(resourceType, resourceId, actor, interactions, description, details)`
records who did what to which resource; the persistence bases call it for you,
so app code rarely calls it directly.

## In-memory implementations and factories

`InMemoryJobPersistence`, `InMemoryQueue` (implements `Dequeue`, with
`schedule` releasing messages when due), `PullConsumer` (polls a `Dequeue`
on an interval, re-enqueues on failure or missing subscriber).

Factories switch on environment and default to in-memory:

| Factory | Env var | `cloud` gives |
| --- | --- | --- |
| `JobPersistenceFactory.instance()` | `ANBARIC_JOB_PERSISTENCE_TYPE` | `CloudJobPersistence` |
| `QueueFactory.instance()` | `ANBARIC_QUEUE_TYPE` | `CloudQueue` |
| `ConsumerFactory.instance(queue)` | — structural — | `PullConsumer` when the queue supports `dequeueSome`, else the push `CloudConsumer` |

An Anbaric platform injects the `cloud` values into deployed apps; never set
them manually in app code.
