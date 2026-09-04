# Human-in-the-loop

Many real workflows need a person: an approval, a correction, a choice. Anbaric
models this with an [`Await`](../features/awaiting-input.md) that parks the job,
a UI where the human acts, and an `updateJob` that resumes it.

## The pattern

1. Put an `Await("…", "HUMAN")` in the state where you need input.
2. Give it the `fields` you expect back and a `resolveUrl` that points the person
   to your UI (per-job, via a function).
3. In your UI, collect the input and call `updateJob(jobId, {…}, actor)`.
4. A transition out of the state reacts to the input and moves the job on.

```ts
const approve = new Await("Approve the request", "HUMAN");
approve.fields = ["approved", "note"];
approve.resolveUrl = (job) => `/approve?job=${job.id}`;

new State("review", [approve], [
    new Transition("approved", (job) => job.properties.get("approved") === true),
    new Transition("rejected", (job) => job.properties.get("approved") === false),
]),
```

## Routing people to the task

Because `resolveUrl` is a function of the job, you can encode everything the page
needs in the link — most importantly the **job id**:

```ts
approve.resolveUrl = (job) =>
    `/approve?job=${job.id}&amount=${job.properties.get("amount")}`;
```

The admin console lists every job **awaiting a human** and turns this
`resolveUrl` into a clickable link, so operators find their queue without you
building one. See [the admin console](../features/admin-console-and-widgets.md).

## Resolving in the UI

Your page reads the job id, gathers the decision, and updates the job as the
logged-in person:

```ts
const jobId = new URL(req.url!, "http://x").searchParams.get("job")!;
const actor = await Human.fromSession(req);     // attribute to the real user
await machine.updateJob(jobId, new Map([["approved", true], ["note", "LGTM"]]), actor);
```

On resume the job **skips its actions** and re-evaluates transitions, so the one
matching `approved` fires. The decision is recorded against the user in the
[audit trail](../features/auditing.md).

## Attaching context for the reviewer

Use `metadata` to carry extra context with the wait (shown alongside the task):

```ts
approve.metadata = (job) => new Map([
    ["submittedBy", job.properties.get("submitter")],
    ["amount", job.properties.get("amount")],
]);
```

It's available on the parked job as `job.awaitMetadata?.metadataMap`.

## Multiple gates

Chain approvals by giving each its own state and `Await`. Because actions after an
`Await` don't run on resume, model each stage as the **next** state:

```ts
new State("manager-review", [managerApprove], [
    new Transition("finance-review", (job) => job.properties.get("managerApproved") === true),
]),
new State("finance-review", [financeApprove], [
    new Transition("approved", (job) => job.properties.get("financeApproved") === true),
]),
```

## See also

- [Awaiting input](../features/awaiting-input.md)
- [Integrating external systems](integrating-external-systems.md) — the non-human variant
- [Serving a web UI](../features/serving-a-web-ui.md)
