# API — State machines

The core types for defining and running a workflow. Import them from `anbaric`:

```ts
import {
    StateMachine, State, Terminal, Action, Await, Transition,
    Job, PropertyDefinition, type Actor,
} from "anbaric";
```

All of these are re-exported by the umbrella `anbaric` package. Types written
below are verbatim from the library.

---

## `StateMachine`

A workflow: an id, its states, the start state, and the property schema for its
jobs. Constructing one registers it (it emits an initialisation record) and
begins processing jobs from the queue.

```ts
constructor(
    workflowId : string,
    states : Array<State>,
    startState? : string,                 // defaults to states[0].id
    dataSchema : Array<PropertyDefinition> = [],
    persistence : JobPersistence = JobPersistenceFactory.instance(),
    queue : Queue = QueueFactory.instance(),
    auditor : Auditor = AuditorFactory.instance(),
)
```

The last three parameters are collaborators with factory-backed defaults — you
rarely pass them except in tests (see [Testing](../patterns/testing.md)).

A workflow is identified by the composite **`(appId, workflowId)`**: the app it's
deployed in and the machine's own id, kept as separate values. `appId` comes from
the environment (`ANBARIC_APP_ID`, set by the platform) — never a constructor
argument — and is available via `getAppId()`. You pass only the machine's own
`workflowId`.

**Read-only fields and methods**

```ts
readonly workflowId : string          // the machine's own id (not namespaced)
getAppId() : string                   // the deploying app's id, from the environment
readonly states : Map<string, State>
readonly startState : string
readonly dataSchema : Map<string, PropertyDefinition>
```

**Methods**

```ts
// Create a job in the start state and queue it for processing.
async startJob(properties? : Map<string, any>, actor? : Actor) : Promise<Job>

// Apply an explicit property change to a job (this is also how you resume an
// Await). Validated against the schema and audited against the actor.
async updateJob(jobId : string, properties : Map<string, any>, actor : Actor) : Promise<void>

// Run a single action against a job immediately. The actor is the action's own.
async executeAction(jobId : string, action : Action) : Promise<void>

// Release the machine's queue consumer (call when shutting down / in tests).
async cleanUp() : Promise<void>
```

`startJob` rejects if the properties fail schema validation (missing a required
property, or a value failing its `validation`). See [Modelling a
workflow](../patterns/modelling-workflows.md) for how processing proceeds.

---

## `State`

A named step: the actions that run while a job sits in it, and the transitions
out of it.

```ts
readonly id : string
actions : Array<Action | Await>
transitions : Array<Transition>
readonly isTerminal : boolean

constructor(
    id : string,
    actions : Array<Action | Await> = [],
    transitions : Array<Transition> = [],
    isTerminal : boolean = false,
)

subscribe(action : Action | Await) : void   // append an action after construction
```

A state's `actions` may mix `Action`s and `Await`s; they are considered in order
when a job is processed.

---

## `Terminal`

A convenience `State` that a job stops at, carrying a success/failure outcome.
Always has no actions or transitions and `isTerminal === true`.

```ts
class Terminal extends State

readonly outcome : Terminal.Outcome

constructor(id : string, outcome : Terminal.Outcome)

enum Terminal.Outcome { SUCCESS = "SUCCESS", FAILURE = "FAILURE" }
```

```ts
new Terminal("shipped", Terminal.Outcome.SUCCESS)
new Terminal("cancelled", Terminal.Outcome.FAILURE)
```

---

## `Action`

A unit of work performed by an actor. Its `run` returns the property changes to
apply — it never mutates the job.

```ts
readonly id : string
name : string
description : string
actor : Actor

constructor(name : string, actor : Actor, description : string = "", id? : string)

// Replaceable function fields — assign your own:
predicate : (job : Job) => boolean            // default: () => true
run : (job : Job) => Promise<Map<string, any>> // default: async () => new Map()
```

You configure an action by assigning `predicate` and `run`:

```ts
const sendWelcome = new Action("Send welcome email", new Code("welcome"));
sendWelcome.run = async (job) => new Map([["welcomeSent", true]]);
```

- **`predicate`** — return `false` to skip this action for a given job.
- **`run`** — return a `Map` of the properties to change. Only properties in the
  machine's schema are applied; others are ignored with a warning.

See [Actions and actors](../features/actions-and-actors.md).

---

## `Await`

A pause point in a state's `actions`. When a job reaches it, the job parks in the
`"Awaiting input"` status and is not processed again until an `updateJob` arrives.
Carries **no actor** — the party that eventually provides the input is described,
not assumed.

```ts
type AwaitParty = "HUMAN" | "EXTERNAL_SYSTEM"

readonly id : string
name : string
description : string
waitingFor? : AwaitParty
fields : Array<string> = []
resolveUrl : string | ((job : Job) => string) = ""
metadata : (job : Job) => Map<string, any>    // default: () => new Map()

constructor(name : string, waitingFor? : AwaitParty, description : string = "", id? : string)

waitForInput(job : Job) : WaitForInput
```

- **`fields`** — the input you expect back (property names).
- **`resolveUrl`** — where the party provides the input. A **function** of the
  job lets you build a per-job link (e.g. with the job id in the query string).
- **`metadata`** — extra context to attach to the wait, computed per job.
- **`waitingFor`** — `"HUMAN"` or `"EXTERNAL_SYSTEM"`; drives how the wait is
  surfaced (a human's `resolveUrl` becomes a clickable link in the dashboard).

```ts
const approve = new Await("Approve the order", "HUMAN");
approve.fields = ["approved"];
approve.resolveUrl = (job) => `/approve?job=${job.id}`;
```

See [Awaiting input](../features/awaiting-input.md) and
[Human-in-the-loop](../patterns/human-in-the-loop.md).

## `WaitForInput`

The value an `Await` produces and stores against a parked job (also readable from
the job as `job.awaitMetadata`). Pure data.

```ts
fields : Array<string>
resolveUrl : string
metadataMap : Map<string, any>
waitingFor? : AwaitParty

constructor(fields? : Array<string>, resolveUrl? : string, metadataMap? : Map<string, any>, waitingFor? : AwaitParty)
```

---

## `Transition`

A target state and a predicate over the job. When a job is processed, the first
transition whose predicate holds moves the job to `to`.

```ts
to : string
predicate : (job : Job) => boolean          // default: () => true

constructor(to : string, predicate? : (job : Job) => boolean)
```

```ts
new Transition("active", (job) => job.properties.get("welcomeSent") === true)
new Transition("scoring")   // unguarded: the actions run, then the job moves on
```

The predicate is optional. Omit it when a state's actions simply run and the job
should move on, rather than inventing a sentinel property for the transition to
read. Guard a transition only when the move is conditional.

---

## `Job`

One instance moving through a machine. You mostly **read** jobs (returned by
`startJob`, or fetched by the CLI); the machine creates new versions on write.

```ts
readonly id : string
readonly state : string
readonly properties : Map<string, any>
readonly workflowId? : string     // the machine's id …
readonly appId? : string          // … and the app it runs in (its composite identity)
readonly startedAt : Date
readonly startedBy : string
readonly lastUpdated : Date
readonly killed : boolean
status : string                  // "active", "Awaiting input" or "Failed"
waitingFor? : string
awaitMetadata? : WaitForInput     // present while parked on an Await

namespace Job {
    const Status = {
        ACTIVE: "active",
        AWAITING_INPUT: "Awaiting input",
        FAILED: "Failed",
    } as const
}
```

Check whether a job is parked with `job.status === Job.Status.AWAITING_INPUT`;
read what it's waiting for from `job.awaitMetadata`.

A job whose action threw is `FAILED`, with the reason in its audit trail. It
stays in its state rather than transitioning, and an update that moves it on
returns it to `ACTIVE` — so a failure is recoverable, not terminal.

---

## `PropertyDefinition`

The schema for one property a job may carry. **Every** property a job holds must
have a definition, or writes to it are rejected.

```ts
id : string
required : boolean = false
example? : any                          // a realistic value, for tooling
validation : (value : any) => boolean   // default: () => true

constructor(id : string)
```

Configure by mutation:

```ts
const email = new PropertyDefinition("email");
email.required = true;
email.example = "someone@example.com";
email.validation = (value) => typeof value === "string" && value.includes("@");
```

Pass the definitions as the `StateMachine`'s fourth argument.

`example` is carried into the machine's published definition, so tools that
start a job — the admin console's **Start** dialog, generated documentation —
can offer a realistic value instead of an empty box. It is never validated and
never becomes a default; it is purely descriptive.

---

## `Schedule`

Which days a machine runs on, and at what times on those days. See
[Scheduled runs](../features/scheduled-runs.md).

```ts
constructor(dayTest : (date : Date) => boolean, times : Array<{ hours : number, minutes : number }>)

getRuns(from : Date, to : Date) : Array<Date>   // exclusive of `from`, inclusive of `to`

static everyDay() : (date : Date) => boolean
static daysOfWeek(days : Array<number>)         // 0 = Sunday … 6 = Saturday
static daysOfMonth(days : Array<number>)        // calendar dates
```

The day test is an ordinary predicate, so any rule you can write in code — the
last working day of a quarter, every other Tuesday — is a schedule.

---

## `JobRunScheduler`

Starts jobs on a timetable. Runs are planned ahead and stored, so the plan
survives a restart and missed runs are caught up rather than skipped.

```ts
static instance() : JobRunScheduler

schedule(machine : StateMachine, at : Schedule,
         lookaheadMs : number = 86_400_000,
         randomRunOffsetMs : [number, number] = [0, 120_000]) : void

tick(now? : Date) : Promise<void>   // plan and start everything owed; mostly for tests
cleanUp() : Promise<void>
```

`lookaheadMs` is how far ahead runs are planned; `randomRunOffsetMs` spreads
machines that would otherwise all start on the same second, and is applied when
the run is planned so the stored time is the time it runs. Pass `[0, 0]` to
start exactly on the minute. Each scheduled job carries its run in the
`scheduledFor` property.

Storage comes from `JobRunSchedulePersistenceFactory` — in memory locally, the
platform database when deployed, where claiming a due run is atomic so several
instances can schedule the same machines safely.

---

## `Actor`

Identifies who performed an operation, for authorization and auditing. An
interface — the concrete actors (`Code`, `Human`, `Agent`, `System`) are in
[Actors and agents](actors-and-agents.md).

```ts
type ActorType = "HUMAN" | "CODE" | "AGENT" | "SYSTEM"

interface Actor {
    type : ActorType
    id : string
    roles : Array<string>
}
```

---

### See also

- [Actors and agents](actors-and-agents.md) — `Code`, `Human`, `Agent`, AI actions
- [Stores](stores.md) — `JsonStore`, `SecretStore`, `SqlStore`
- [Environment and factories](environment.md) — the `ANBARIC_*` variables
