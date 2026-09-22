# Build your first app

We'll build a small **expense approval** app end to end: an expense is submitted,
a manager approves or rejects it, and approved expenses are paid. It uses a state
machine, a human `Await`, and a web page — and runs on your laptop before you
deploy it.

## 1. Set up the project

```bash
mkdir expenses && cd expenses
npm init -y
npm install anbaric
npm pkg set type=module
npm pkg set main=src/main.ts
```

## 2. Model the workflow

An expense moves: `submitted → (review) → approved → paid`, or `submitted →
rejected`. The review step waits for a human.

```ts
// src/machine.ts
import {Action, Await, Code, JobPersistenceFactory, PropertyDefinition, State, StateMachine, Terminal, Transition} from "anbaric";

// Shared with the web layer so pages can read a job's state without a reload.
const persistence = JobPersistenceFactory.instance();

const amount = new PropertyDefinition("amount");
amount.required = true;
amount.validation = (v) => typeof v === "number" && v > 0;

const approved = new PropertyDefinition("approved");
approved.validation = (v) => typeof v === "boolean";

const paid = new PropertyDefinition("paid");
paid.validation = (v) => typeof v === "boolean";

// A human decision point.
const review = new Await("Review the expense", "HUMAN");
review.fields = ["approved"];
review.resolveUrl = (job) => `/review?job=${job.id}`;

// An automated payment step.
const payOut = new Action("Pay the expense", new Code("payments"));
payOut.run = async (job) => {
    // ... call your payment provider with job.properties.get("amount") ...
    return new Map([["paid", true]]);
};

const expenses = new StateMachine("expenses", [
    new State("submitted", [review], [
        new Transition("approved", (job) => job.properties.get("approved") === true),
        new Transition("rejected", (job) => job.properties.get("approved") === false),
    ]),
    new State("approved", [payOut], [
        new Transition("paid", (job) => job.properties.get("paid") === true),
    ]),
    new Terminal("paid", Terminal.Outcome.SUCCESS),
    new Terminal("rejected", Terminal.Outcome.FAILURE),
], "submitted", [amount, approved, paid], persistence);

export {expenses, persistence};
```

Notice the shape: the `submitted` state parks on `review` until a manager sets
`approved`; a transition then routes to `approved` or `rejected`; the `approved`
state pays automatically and ends at `paid`.

## 3. Serve a tiny UI

The review page reads the job id from the query string and resolves the `Await`
by updating the job. Updating a job only *queues* the change, so the page
acknowledges the click, then **polls the job and updates in place** until it
settles - it never reloads to find out what happened. (Any HTML works; here's
the shape.)

```ts
// src/main.ts
import {createServer} from "node:http";
import {Human, serializeJob, SystemActor} from "anbaric";
import {expenses, persistence} from "./machine.js";

const reviewPage = (jobId : string) => `<!doctype html>
<p id="status">Loading…</p>
<button id="approve">Approve</button>
<script>
    const jobId = ${JSON.stringify(jobId)};
    const status = document.getElementById("status");
    const approve = document.getElementById("approve");
    let submitted = false;
    let polls = 0;
    // Done when the job ended, or is parked waiting for this person's decision.
    const settled = (job) => job.status !== "ACTIVE" || (job.waitingFor && ! submitted);

    const refresh = async () => {
        const job = await (await fetch("status?job=" + jobId)).json();   // relative link!
        status.textContent = job.status === "FAILED" ? "Failed - see the audit trail" : "State: " + job.state;
        approve.disabled = job.state !== "submitted";
        if (settled(job)) return;
        if (polls++ < 60) setTimeout(refresh, 1000);                       // at most once a second
        else status.textContent += " - still working, check back shortly";
    };

    approve.onclick = async () => {
        approve.disabled = true;
        submitted = true;
        polls = 0;
        status.textContent = "Approval submitted - processing…";
        await fetch("review?job=" + jobId, { method: "POST" });
        refresh();
    };

    refresh();
</script>`;

createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const jobId = url.searchParams.get("job") ?? "";

    if (url.pathname === "/submit") {
        const job = await expenses.startJob(new Map([["amount", 42]]));
        res.writeHead(200).end(`Submitted ${job.id}`);
        return;
    }

    if (url.pathname === "/status") {
        const job = await persistence.retrieve(jobId, SystemActor.actor);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(serializeJob(job)));
        return;
    }

    if (url.pathname === "/review" && req.method === "POST") {
        const actor = await Human.fromSession(req);            // the logged-in manager
        await expenses.updateJob(jobId, new Map([["approved", true]]), actor);
        res.writeHead(202).end();                              // queued - the page polls for the outcome
        return;
    }

    res.writeHead(200, { "content-type": "text/html" }).end(reviewPage(jobId));
}).listen(Number(process.env.PORT ?? 3000));
```

Only fall back to a plain form `POST` with a redirect back to the page when the
client can't run script; then the page shows the state as of the reload, and the
person has to refresh to see it move. See
[UX practices](ux-practices.md) for the rules on polling and feedback.

> Locally there's no signed session, so `Human.fromSession` will throw — for a
> local run, substitute `new Human("dev", "manager")`. Deployed, the real session
> is resolved. See [Serving a web UI](../features/serving-a-web-ui.md).

## 4. Run it locally

```bash
npx tsx src/main.ts
```

No database, no platform — persistence and queueing are in-memory, and jobs
progress automatically. Hit `/submit`, then resolve the review. Watch the audit
trail print to your console.

## 5. Deploy it

```bash
anbaric login
anbaric app configure     # sets .anbaric/app-config.json (name + internalPort)
anbaric app deploy
```

The same code now runs platform-backed. Drive and inspect it:

```bash
anbaric jobs list expenses
anbaric jobs watch <job-id>
```

Open the platform's admin console to see expenses **awaiting input**, each
linking to its `/review` page.

## Where to go next

- [Modelling a workflow](modelling-workflows.md) — design more complex processes
- [Human-in-the-loop](human-in-the-loop.md) — richer approval and form flows
- [Testing your app](testing.md) — drive the machine in memory
