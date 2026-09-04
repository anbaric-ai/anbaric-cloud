# Authorization with actors and roles

Every operation in Anbaric names an **actor** — `{ type, id, roles }` — and every
action declares the actor that performs it. Together with **roles** and action
**predicates**, this is how you control who is allowed to do what.

## Attribute to real actors

The foundation of authorization is honest attribution. Don't pass a generic
placeholder — pass the actual actor:

```ts
// A person, resolved from their platform session:
const actor = await Human.fromSession(request);
await machine.updateJob(jobId, new Map([["approved", true]]), actor);

// An integration, as a named Code actor:
await machine.updateJob(jobId, new Map([["signed", true]]), new Code("esign-webhook"));
```

`Human.fromSession` gives you the user's real id **and roles** from the platform,
so your checks act on trustworthy identity rather than something the client
claimed.

## Carry roles

Actors carry `roles: Array<string>`. Assign them when you construct an actor, or
let `fromSession` supply them:

```ts
new Human("ada", "admin");
new Human("ada", ["manager", "finance"]);
```

## Gate work with predicates

Use an action's `predicate` to require a role before the action runs. Since the
action carries its actor, you can check that actor's roles — or, for
externally-driven updates, check before you call `updateJob`:

```ts
const approve = new Action("Approve", new Human("ada", "manager"));
approve.predicate = (job) => approve.actor.roles.includes("manager");
```

```ts
// Guard an update at the point you perform it:
const user = await Human.fromSession(request);
if (!user.roles.includes("manager")) {
    response.writeHead(403).end("Managers only");
    return;
}
await machine.updateJob(jobId, new Map([["approved", true]]), user);
```

## Design tips

- **Least privilege.** Give actors the narrowest roles that let them do their job;
  check for the specific role a step needs, not a broad "admin".
- **Encode the rule where the work happens.** A transition or action predicate is
  the natural home for "only a manager may approve".
- **Let the audit trail back you up.** Because every change is recorded against
  the actor, you can always answer *who* approved something — see
  [Auditing](../features/auditing.md).

## See also

- [Actions and actors](../features/actions-and-actors.md)
- [API: Actors and agents](../api/actors-and-agents.md)
- [Serving a web UI](../features/serving-a-web-ui.md) — resolving the session user
