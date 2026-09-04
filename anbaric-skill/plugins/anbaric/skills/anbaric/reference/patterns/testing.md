# Testing your app

Most of your app's logic lives in plain functions — an action's `run`, a
transition's predicate, a property's `validation`. These are trivial to test
directly, no platform required. For wider tests, the in-memory stack lets a whole
machine run in one process.

## Test the pure functions

An action's `run` takes a `Job` and returns a `Map` of changes. Build a job,
call it, assert on the result:

```ts
import {expect, test} from "vitest";
import {Job} from "anbaric";
import {payOut} from "../src/actions/payOut.js";

test("payOut marks the expense paid", async () => {
    const job = new Job("job-1", new Map([["amount", 42]]), "approved");
    const changes = await payOut.run(job);
    expect(changes.get("paid")).toBe(true);
});
```

`new Job(id, properties, state)` is all you need to construct a job for a test
(later constructor arguments have sensible defaults).

Transition predicates and property validations are just as easy:

```ts
test("advances once approved", () => {
    const job = new Job("job-1", new Map([["approved", true]]), "review");
    const toApproved = machineTransition("approved");
    expect(toApproved.predicate(job)).toBe(true);
});

test("amount must be positive", () => {
    expect(amount.validation(42)).toBe(true);
    expect(amount.validation(-1)).toBe(false);
});
```

## Test predicates that select actors

If several actions share a state and choose themselves by `predicate`, assert the
selection:

```ts
test("low-priority tickets auto-triage", () => {
    const job = new Job("t1", new Map([["priority", "low"]]), "open");
    expect(autoTriage.predicate(job)).toBe(true);
    expect(escalate.predicate(job)).toBe(false);
});
```

## Integration with the in-memory stack

With no `ANBARIC_*` variables set, a `StateMachine` uses in-memory persistence and
queueing, so you can exercise it end to end. Pass explicit in-memory collaborators
when you want to inspect state directly, and drive the machine through its public
methods:

```ts
import {StateMachine, Human, Code} from "anbaric";

const machine = buildExpensesMachine();          // your factory
const job = await machine.startJob(new Map([["amount", 42]]));

await machine.updateJob(job.id, new Map([["approved", true]]), new Human("dev", "manager"));
// … then read the job back to assert on it (e.g. via your persistence instance).
```

`executeAction(jobId, action)` runs one action immediately and applies its
changes — handy for asserting an action's effect within a live machine.

## Tips

- **Keep side effects injectable.** If an action calls a payment provider, take
  the client as a parameter or module dependency you can stub, so `run` is
  testable without the real service.
- **Assert on returned changes, not on internals.** Test that `run` returns the
  right `Map` and that predicates return the right booleans — that's your logic.
- **Validate your schema.** A quick test that a bad value fails its
  `PropertyDefinition.validation` catches schema mistakes early.

## See also

- [Actions and actors](../features/actions-and-actors.md)
- [API: State machines](../api/state-machine.md)
