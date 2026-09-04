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
import {Action, Await, Code, PropertyDefinition, State, StateMachine, Terminal, Transition} from "anbaric";

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
], "submitted", [amount, approved, paid]);

export {expenses};
```

Notice the shape: the `submitted` state parks on `review` until a manager sets
`approved`; a transition then routes to `approved` or `rejected`; the `approved`
state pays automatically and ends at `paid`.

## 3. Serve a tiny UI

The review page reads the job id from the query string and resolves the `Await`
by updating the job. (Any HTML works; here's the shape.)

```ts
// src/main.ts
import {createServer} from "node:http";
import {Human} from "anbaric";
import {expenses} from "./machine.js";

createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/submit") {
        const job = await expenses.startJob(new Map([["amount", 42]]));
        res.writeHead(200).end(`Submitted ${job.id}`);
        return;
    }

    if (url.pathname === "/review" && req.method === "POST") {
        const jobId = url.searchParams.get("job")!;
        const actor = await Human.fromSession(req);            // the logged-in manager
        await expenses.updateJob(jobId, new Map([["approved", true]]), actor);
        res.writeHead(303, { Location: "review?job=" + jobId }).end();  // relative link!
        return;
    }

    res.writeHead(200, { "content-type": "text/html" })
       .end(`<form method="post" action="review?job=${url.searchParams.get("job") ?? ""}">…</form>`);
}).listen(Number(process.env.PORT ?? 3000));
```

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
