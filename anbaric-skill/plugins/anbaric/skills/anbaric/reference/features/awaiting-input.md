# Awaiting input

Sometimes a job can't move on by itself — it needs a person to approve
something, fill in a form, or make a decision, or it needs a callback from
another system. An **`Await`** is a step in a state's action list that *pauses*
the job instead of running.

## What an Await does

When a job reaches an `Await`, it stops running actions and is **parked**: its
`status` becomes `"Awaiting input"` (distinct from its `state`), and it is not
processed again until an `updateJob` arrives. The job holds a **`WaitForInput`**
describing what it's waiting on — the expected `fields`, a `resolveUrl`, the
party (`HUMAN` or `EXTERNAL_SYSTEM`), and any metadata.

```ts
import {Await, State, StateMachine, Transition} from "anbaric";

const approve = new Await("Approve the order", "HUMAN");
approve.fields = ["approved"];                            // the input we expect back
approve.resolveUrl = (job) => `/approve?job=${job.id}`;   // where a person provides it

const fulfilment = new StateMachine("fulfilment", [
    new State("review", [approve], [
        new Transition("approved", (job) => job.properties.get("approved") === true),
    ]),
    new State("approved"),
]);

const order = await fulfilment.startJob(new Map([["total", 4200]]));
// The job reaches `approve`, parks in "Awaiting input", and waits.
```

## Resuming a parked job

A parked job resumes when you update its properties — typically from the UI or
API where the input was provided:

```ts
await fulfilment.updateJob(order.id, new Map([["approved", true]]), actor);
```

On resume the job **skips its actions** and only re-evaluates its transitions, so
the input you supplied drives it on. Once a transition moves it to another state,
the await clears. Actions placed *after* an `Await` in the same state do **not**
run on resume — model post-input work as the next state.

## The resolveUrl

`resolveUrl` is where the party goes to provide the input. Make it a **function
of the job** so you can build a per-job link — for example putting the job id in
the query string so your form knows which job it's resolving:

```ts
approve.resolveUrl = (job) => `/approve?job=${job.id}&total=${job.properties.get("total")}`;
```

Write it **app-relative** (an absolute path like `/approve`, as above) — it's a
page your own app serves. For a `HUMAN` await, the
[admin dashboard](admin-console-and-widgets.md) shows this `resolveUrl` as a
clickable link in its "Awaiting input" list, and resolves it onto your app
automatically (to `/app/<your-app>/approve?…`), so operators jump straight to the
task without you hard-coding the app path.

## Humans vs external systems

The `waitingFor` argument records who you're waiting on:

- **`"HUMAN"`** — a person will provide the input (the dashboard links them to
  the `resolveUrl`). See [Human-in-the-loop](../patterns/human-in-the-loop.md).
- **`"EXTERNAL_SYSTEM"`** — another service will call back with the result. See
  [Integrating external systems](../patterns/integrating-external-systems.md).

Either way the job simply waits until an `updateJob` supplies the expected
fields — Anbaric doesn't care whether a human or a machine sends it.

## Reading the wait

While parked, a job exposes what it's waiting for:

```ts
if (job.status === Job.Status.AWAITING_INPUT) {
    const wait = job.awaitMetadata;      // a WaitForInput
    wait?.fields;        // ["approved"]
    wait?.resolveUrl;    // "/approve?job=..."
    wait?.waitingFor;    // "HUMAN"
}
```

The pause is also recorded in the [audit trail](auditing.md) as an `AWAIT`
interaction.

## Next

- [Human-in-the-loop](../patterns/human-in-the-loop.md) — a full approval app
- [API: Await](../api/state-machine.md#await)
