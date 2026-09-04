# Auditing

Every write in Anbaric is recorded against the **actor** that made it — which is
why the state machine and the stores all take an actor. You get a complete trail
of who did what, for free, with no extra code.

## What gets recorded

An audit record captures the **resource** (a job, document, secret or SQL
statement), the **actor**, the **interaction** (create, update, state change,
delete, await, kill, read, list…), a short **description**, and details of the
change. For example:

- a job created, and every from→to state change with the actor that caused it;
- a document created or saved (with your change description);
- a secret created or read — **never its value**;
- a job parking on an `Await` (an `AWAIT` interaction).

## You already have it

You don't call the auditor directly. It's wired into the state machine and the
stores, so simply doing your work produces the trail:

```ts
await machine.updateJob(jobId, new Map([["approved", true]]), new Human("chris", "manager"));
// → recorded: job <id>, actor chris, UPDATE_PROPERTIES, "Properties Updated"
```

The key is to pass a **meaningful actor** — `new Human("chris", "manager")`, or
`Human.fromSession(req)` in a web app — so the record names a real person rather
than generic code.

## Where records go

Like the stores, the auditor is chosen from the environment:

- **Local** — records print to the console (`ConsoleAuditor`), so you can see the
  trail as you develop.
- **Deployed** — the platform persists them, and they're browsable in the [admin
  console](admin-console-and-widgets.md).

Selection is by `ANBARIC_AUDITOR_TYPE` (`cloud` deployed), set by the platform.

Reads and lists can be audited too, but the platform masks them by default to
keep the volume manageable.

## Next

- [Authorization with actors and roles](../patterns/authorization.md)
- [The admin console and widgets](admin-console-and-widgets.md)
