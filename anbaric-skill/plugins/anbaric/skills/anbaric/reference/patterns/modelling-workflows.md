# Modelling a workflow

The art of Anbaric is turning a real process into states, actions and
transitions. A few guidelines make machines that are easy to reason about.

## Start from the states

List the distinct **situations** a job can be in — not the steps, the *resting
places*. For an order: `placed`, `packing`, `shipped`, `cancelled`. These become
your `State`s; the end ones become `Terminal`s.

```ts
new State("placed", [], [...transitions]),
new State("packing", [packItems], [...transitions]),
new Terminal("shipped", Terminal.Outcome.SUCCESS),
new Terminal("cancelled", Terminal.Outcome.FAILURE),
```

## Actions do; transitions decide

Keep the two roles separate:

- **Actions** change the job's data (`packItems` sets `packed: true`).
- **Transitions** read the data and choose the next state.

An action never picks the next state — it just records what happened, and a
transition reacts. This keeps each piece testable and the flow visible.

```ts
new State("packing", [packItems], [
    new Transition("shipped", (job) => job.properties.get("packed") === true),
]),
```

## Order matters

Within a state, actions run in listed order, and the **first** satisfied
transition wins. Put more specific transitions first:

```ts
new State("placed", [], [
    new Transition("cancelled", (job) => job.properties.get("cancelled") === true),
    new Transition("packing",   (job) => job.properties.get("paid") === true),
]),
```

## Use predicates to select who acts

Several actions can share a state; each runs only when its `predicate` holds. This
routes work without extra states:

```ts
const autoTriage = new Action("Auto triage", new Code("triage-bot"));
autoTriage.predicate = (job) => job.properties.get("priority") === "low";

const escalate = new Action("Escalate", new Code("rules"));
escalate.predicate = (job) => job.properties.get("priority") === "high";

new State("open", [autoTriage, escalate], [/* transitions */]);
```

## Waiting is a first-class state

When a job can't proceed without outside input, model it with an
[`Await`](../features/awaiting-input.md) rather than polling or blocking. The job
parks cleanly and resumes when the input arrives:

```ts
new State("review", [new Await("Approve", "HUMAN")], [
    new Transition("approved", (job) => job.properties.get("approved") === true),
]),
```

## Polling and retries

If a state should re-check periodically (say, waiting on an external status), have
an action that makes progress or leaves things unchanged. When something changes
the job is re-processed; when nothing changes in the same state, it's re-checked
after a back-off — so a state can gently poll without a busy loop.

```ts
const poll = new Action("Check delivery status", new Code("carrier"));
poll.run = async (job) => {
    const status = await fetchStatus(job.properties.get("tracking"));
    return status === "delivered" ? new Map([["delivered", true]]) : new Map();
};
```

## Validate your data

Give every property a `PropertyDefinition` with a `validation`. Actions can't
write anything that fails validation or isn't declared, so a mis-behaving action
(or agent) can't corrupt a job.

```ts
const amount = new PropertyDefinition("amount");
amount.required = true;
amount.validation = (v) => typeof v === "number" && v > 0;
```

## See also

- [State machines](../features/state-machines.md)
- [Human-in-the-loop](human-in-the-loop.md)
- [Integrating external systems](integrating-external-systems.md)
