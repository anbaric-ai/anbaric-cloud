# Auto-progression: change detection, same-state back-off, terminal states

How `StateMachine.progressJob` decides whether — and when — to re-run a job.
Three mechanics work together: (A) mark a job dirty only when a value actually
changes, (B) delay a re-enqueue that keeps a job in the same state, and terminal
states that stop progression entirely. Plus guidance on writing action
predicates.

## How a job progresses

The consumer delivers a job to `progressJob(jobId)`, which:

1. retrieves the job and looks up its current `State`; **if that state is
   terminal, it returns immediately** — terminal states are inert;
2. runs every action in the state whose `predicate` passes (and whose actor is
   authorised), applying the properties each returns — each key is validated on
   its own (valid keys apply; invalid/undeclared keys are skipped with a warning
   rather than dropping the whole map), and a key is only written when its value
   actually **differs** from what's stored (mechanic A);
3. evaluates the state's transitions in order, taking the first whose predicate
   holds (at most one per progression);
4. if nothing changed, returns without saving or re-enqueuing — the job rests;
5. otherwise saves, then decides re-enqueue by the resulting state:

| Resulting state | Re-enqueue |
| --- | --- |
| terminal | none — the job is done |
| a new (non-terminal) state | `enqueue` immediately — run the next state's work now |
| the same (non-terminal) state | `schedule` ~5 min out — back off (mechanic B) |

## Mechanic A — mark dirty only on an actual change

Any applied property used to set `pristine = false`, even writing an identical
value, so an action returning the same value every tick kept the job "changed"
→ re-enqueued → re-run forever, each run possibly a real LLM/HTTP call. Now the
action loop skips a write whose value equals the stored one:

```
if (job.properties.has(key) && this.sameValue(job.properties.get(key), value)) continue;
```

`sameValue` is `a === b || JSON.stringify(a) === JSON.stringify(b)` — a cheap
strict check for primitives, falling back to a structural compare for
arrays/objects (property values are JSON-serialisable, so this is sound;
caveat: objects assembled in different key order compare unequal). A taken
transition still counts as a change independently.

## Mechanic B — delay a re-enqueue that stays in the same state

Even with A, a job that legitimately changes something each tick but does not
transition (polling, waiting for a condition) would re-enqueue immediately and
spin. When a progression changes the job but the state does not change, it
re-enqueues with a delay instead:

```
if (this.states.get(newState ?? job.state)?.isTerminal) return;      // reached terminal — stop
if (newState !== undefined) await this.queue.enqueue(job.id, this.workflowId);          // transitioned — now
else await this.queue.schedule(job.id, this.workflowId, new Date(Date.now() + this.sameStateDelayMs));   // same state — back off
```

`schedule(jobId, workflowId, due)` is on the `Queue` interface and honoured by
both `InMemoryQueue` and `PostgresQueue` (a message is only delivered once its
`due` has passed). The delay is a `StateMachine` constructor option
`sameStateDelayMs`, defaulting to `5 * 60_000`.

## Terminal states

A state can be terminal. A job that reaches one stops: `progressJob` never
re-enqueues after a transition into a terminal state, and a delivery that finds
a job already in a terminal state returns immediately. This is the explicit
"the workflow has finished" signal — cleaner than relying on an action's guard
predicate to simply stop producing work, and it means a finished job never sits
on an endless same-state back-off.

- `State` carries a `readonly isTerminal` flag (default `false`).
- `Terminal extends State` sets it for you and records an outcome:
  `new Terminal("finished", Terminal.Outcome.SUCCESS)` /
  `Terminal.Outcome.FAILURE`. A `Terminal` has no actions or transitions — it is
  purely an endpoint. (Both live in `anbaric-tsapi`.)

```
const machine = new StateMachine("order", [
    new State("placed", [charge], [new Transition("paid", j => j.properties.get("charged") === true)]),
    new State("paid", [ship], [
        new Transition("shipped", j => j.properties.get("shipped") === true),
        new Transition("refunded", j => j.properties.get("chargeFailed") === true),
    ]),
    new Terminal("shipped", Terminal.Outcome.SUCCESS),
    new Terminal("refunded", Terminal.Outcome.FAILURE),
], "placed", schema);
```

## Advice on action predicates (guard your actions)

The framework runs **every** action whose `predicate` passes on **every**
progression of its state, so an unguarded action re-runs each tick.

- **Guard on whether the work still needs doing** — usually the absence of the
  action's own output:
  ```
  draft.run = async (job) => new Map([["article", await write(job)]]);
  draft.predicate = (job) => !job.properties.has("article");   // run once, until "article" exists
  ```
- **The predicate gates before `run`, and the cost lives in `run`.** Guarding the
  predicate is the only way to avoid paying for redundant work — change detection
  (A) still calls `run` and only discards the identical result afterwards.
- **Predicates also route.** Sibling actions select who acts, e.g. an escalate
  action guarded on `priority === "high"` beside a low-priority sibling.
- **Polling pattern.** For "keep checking until ready", pair a condition guard
  with the same-state back-off (B): `predicate = j => !j.properties.get("ready")`,
  `run` checks the external system and sets `ready`, a transition fires on
  `ready`. The job polls every `sameStateDelayMs` rather than hot-looping.
- **Termination is a state, not a predicate.** When a job is *finished*, transition
  it to a `Terminal` state — don't leave it in a live state relying on predicates
  returning false. Terminal states stop the job; a live state with an unsatisfiable
  transition just polls (B) forever.

## Notes for maintainers

- Time: `progressJob` uses `Date.now()` for the back-off `due`. Tests must
  control or tolerate time — the suite asserts `schedule` (with a future `due`)
  vs `enqueue` rather than exact delays.
- User-facing docs: the predicate advice and terminal states still need a short
  section in the package README (tracked in the eval backlog).
