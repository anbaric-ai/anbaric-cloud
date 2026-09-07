# State machines

A state machine models a process as **jobs** moving through named **states**.
Actions run while a job sits in a state; transitions decide where it goes next.

## Defining a machine

A `StateMachine` takes an id, its states, the start state, and the property
schema for its jobs.

```ts
import {Action, Code, PropertyDefinition, State, StateMachine, Transition} from "anbaric";

const sendWelcome = new Action("Send welcome email", new Code("welcome"));
sendWelcome.run = async (job) => {
    const email = job.properties.get("email");
    console.log(`Sending welcome email to ${email}`);
    return new Map([["welcomeSent", true]]);   // properties to add to the job
};

const emailSent = new PropertyDefinition("welcomeSent");
emailSent.validation = (value) => typeof value === "boolean";

const onboarding = new StateMachine(
    "onboarding",
    [
        new State("new", [sendWelcome], [
            new Transition("active", (job) => job.properties.get("welcomeSent") === true),
        ]),
        new State("active"),
    ],
    "new",                        // start state
    [emailSent],                  // property schema
);
```

## Starting a job

```ts
const customer = await onboarding.startJob(new Map([["email", "ada@example.com"]]));
```

The job starts in `new`. When it is processed, `sendWelcome` runs, sets
`welcomeSent`, and the transition advances it to `active`. Locally this happens
automatically in memory; deployed, it happens on the platform — the same code.

## How a job progresses

Each time a job is processed, the machine:

1. Runs the current state's **actions in order** — each may skip itself (via its
   `predicate`) and returns property changes, which are validated against the
   schema and applied.
2. Evaluates the state's **transitions in order** — the first whose predicate
   holds moves the job to that state.
3. Repeats until the job reaches a state where no transition fires. If the state
   changed or a property changed, the job is re-processed (state changes
   immediately; same-state changes after a short back-off) so a machine can poll
   or make progress over time. A **terminal** state stops processing for good.

Because actions only *propose* changes and the machine *applies* them, a job's
data is always schema-valid, whoever wrote it.

A state's actions run **every time** the job is processed in that state, not
once on entry. That is deliberate — it lets a predicate be time-based
(`(job) => Date.now() > retryAfter(job)`) or wait on something external. For
work that must happen only once, guard it:

```ts
fetchReport.predicate = (job) => !job.properties.has("report");
```

## Failing a job

If an action throws, the job is marked **failed** (`Job.Status.FAILED`) and the
reason is recorded against it in the audit trail. You don't need to catch
errors yourself to stop a job getting stuck — throwing *is* how you say "this
job cannot proceed":

```ts
chargeCard.run = async (job) => {
    const outcome = await payments.charge(job.properties.get("amount"));
    if (!outcome.ok) throw new Error(`Card declined for job ${job.id}: ${outcome.reason}`);
    return new Map([["charged", true]]);
};
```

A failed job stays where it is rather than transitioning, but it isn't dead: an
update that moves it on clears the status, so correcting the data and calling
`updateJob` retries it.

## Terminal states

Mark the end of a process with `Terminal`, which carries an outcome:

```ts
import {Terminal, Transition} from "anbaric";

new State("packing", [packItems], [
    new Transition("shipped", (job) => job.properties.get("packed") === true),
]),
new Terminal("shipped", Terminal.Outcome.SUCCESS),
new Terminal("cancelled", Terminal.Outcome.FAILURE),
```

A job that reaches a terminal state stops and is never processed again.

## Moving on unconditionally

A transition's predicate is optional. If a state's actions simply run and the
job should then move on, leave the guard off — there is no need to invent a
sentinel property for the transition to test:

```ts
new State("enriching", [lookUpCompany], [new Transition("scoring")]),
```

Guard a transition when the move is genuinely conditional — branching, or
waiting for something to become true. If the concern is "what if the action
fails?", throw from the action instead (see [Failing a job](#failing-a-job));
you don't need an error property and a guard that reads it.

## Branching

A state can have several transitions; the first satisfied one wins. Put the more
specific conditions first.

```ts
new State("placed", [], [
    new Transition("cancelled", (job) => job.properties.get("cancelled") === true),
    new Transition("packing",   (job) => job.properties.get("paid") === true),
]),
```

## Influencing a job from outside

Beyond the automatic processing, there are three ways to drive a job:

```ts
await machine.startJob(properties, actor);                 // create one
await machine.updateJob(jobId, new Map([["paid", true]]), actor);  // change properties
await machine.executeAction(jobId, someAction);            // run one action now
```

`updateJob` is also how you **resume a job parked on an `Await`** — see
[Awaiting input](awaiting-input.md).

## Next

- [Actions and actors](actions-and-actors.md) — the doers
- [API: State machines](../api/state-machine.md) — exact signatures
- [Modelling a workflow](../patterns/modelling-workflows.md) — design guidance
