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
