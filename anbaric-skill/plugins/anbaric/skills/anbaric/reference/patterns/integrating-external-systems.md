# Integrating external systems

Workflows often hand off to another service and wait for it to come back — a
payment processor, a document signer, a background job, a webhook. Anbaric handles
this the same way it handles people: park the job on an `Await`, and resume it
when the result arrives.

## Wait for a callback

Use an `Await` with `"EXTERNAL_SYSTEM"`. Kick off the external work, then let the
job park until the system reports back:

```ts
const startSigning = new Action("Send for signature", new Code("esign"));
startSigning.run = async (job) => {
    const ref = await eSignProvider.createEnvelope(job.properties.get("documentUrl"));
    return new Map([["envelopeRef", ref]]);
};

const awaitSignature = new Await("Await signature", "EXTERNAL_SYSTEM");
awaitSignature.fields = ["signed"];

new State("signing", [startSigning, awaitSignature], [
    new Transition("signed", (job) => job.properties.get("signed") === true),
]),
```

The `startSigning` action runs first (kicking off the work and recording a
reference), then the job reaches the `Await` and parks. It won't be processed
again until an update supplies `signed`.

## Resume from a webhook

When the external system calls your app back, look up the job (e.g. by a
reference you stored) and update it:

```ts
// POST /webhooks/esign
const { envelopeRef, status } = parseWebhook(req);
const jobId = await lookupJobByEnvelope(envelopeRef);   // your own mapping
await machine.updateJob(jobId, new Map([["signed", status === "completed"]]),
    new Code("esign-webhook"));
```

The update re-enqueues the job; on resume it evaluates its transitions and moves
on. Attribute the change to a `Code` actor representing the integration, so the
[audit trail](../features/auditing.md) shows what drove it.

> **Correlate reliably.** Store the external reference as a job property (or in a
> [document/SQL store](../features/documents-and-secrets.md)) when you start the
> work, so the webhook can find the right job. Don't rely on the `Await`'s
> internal id.

## Polling instead of callbacks

If the external system has no webhook, poll it from a same-state action. The job
re-checks after a back-off until the status flips:

```ts
const checkStatus = new Action("Poll payment status", new Code("payments"));
checkStatus.run = async (job) => {
    const status = await gateway.status(job.properties.get("paymentRef"));
    return status === "settled" ? new Map([["settled", true]]) : new Map();
};

new State("charging", [checkStatus], [
    new Transition("settled", (job) => job.properties.get("settled") === true),
]),
```

Returning an empty map leaves the job unchanged, so it's simply re-checked later
rather than churning.

## Idempotency

External callbacks can arrive more than once. Because actions return *changes* and
transitions are predicate-driven, a repeated `updateJob` that sets the same
property is harmless — the job won't move twice. Still, make the *side effects* in
your actions idempotent (don't double-charge on a retried `run`).

## See also

- [Awaiting input](../features/awaiting-input.md)
- [Human-in-the-loop](human-in-the-loop.md)
- [The SQL store](../features/sql-store.md) — for correlation tables
