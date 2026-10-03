# Staying within memory

A deployed app gets **512 MB** of memory and a quarter of a vCPU, and Node gives
your code a heap of roughly **270 MB** of that. This is a deliberate shape: an
Anbaric app is a set of small steps that each read a job, do one thing and
record the result. The job's data lives in the platform, not in your process,
so a well-shaped app rarely needs more than a few tens of megabytes however
many jobs it has. The crashes we see come from code that quietly turns the
process into a cache.

## How a crash looks

Two different limits, two different symptoms:

- **The heap limit.** Node aborts with
  `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
  in `anbaric app tail <name>`, usually preceded by a run of
  `Mark-Compact` lines as the garbage collector tries and fails to find room.
  This is the common one and it is always retained objects, not a garbage
  collector that stopped working: the collector only frees what nothing refers
  to any more.
- **The container limit.** Buffers and native memory live outside the heap. If
  they take the container past 512 MB the container is killed outright, with no
  stack trace: `anbaric app status <name>` shows the task stopped with
  `OutOfMemoryError: Container killed due to memory usage`.

Either way the platform restarts the app and the queue redelivers any job it
had not confirmed, so the damage is a gap, not lost work — unless the same job
takes the app down every time, which is what the rest of this page prevents.

## Do not hold jobs

The temptation is to load jobs into a module-level `Map` for quick lookup, or
to fetch every job in a state before deciding which to act on. Every job held is
a job that is never collected.

- An action is given its job. Read what it needs with `await job.properties.get(...)`
  — properties are fetched lazily, one at a time, and only the ones you ask for
  — and return a `Map` of changes. Keep nothing between steps.
- Anything that has to be found later belongs in a store, not a variable: the
  [JSON store](../features/documents-and-secrets.md) for documents, the
  [SQL store](../features/sql-store.md) for anything you would otherwise sort,
  filter or aggregate in JavaScript. Let the database do the `WHERE`.
- Page. `store.list(actor, pageSize, page)` exists so that nobody has to fetch
  a whole collection; a step that walks a collection should take one page, act,
  and move on, ideally recording where it got to in the job so a restart resumes
  rather than starts over.

## Keep steps small

Memory follows the biggest single step, not the number of jobs. A step that
builds a 50 MB report in a string before writing it needs 50 MB plus every
intermediate copy; a step that writes a line at a time needs a line.

- Several small states beat one large one: each gives the collector a point at
  which nothing from the previous step is reachable, and each is a point the
  job can resume from.
- When a step fans out — one job per row of an upload, say — start the child
  jobs and finish; do not wait on them in memory. Use the parent's state and
  the children's results in the store to decide when it is done.
- A model call's response is bounded by the model's output limit, but what you
  send is not: do not stuff whole documents into a prompt from memory when a
  retrieval step could pass the relevant part.

## Files are whole

`FileStorage.get` returns the file's bytes as one `Uint8Array`, and `put` takes
one: there is no streaming, and the bytes travel to and from the platform as a
single request. Treat the file store as a place for documents, not datasets.

- Keep individual files to a few megabytes. Anything that would be tens of
  megabytes is better split into parts at a path prefix (`exports/2026-10/part-001`)
  and processed part by part, one per step.
- Never `list` and then `get` every file under a prefix in one step. `list`
  itself is cheap — metadata only, no contents — and is what tells you how many
  parts there are to walk.
- Parse while you go. Decode a CSV part line by line and write rows to the SQL
  store as they are read, rather than building the whole array first.

## Watch the web side too

Your app serves HTTP as well as running steps, and the two share the heap.

- Stream large responses with `response.write` as you produce them, rather
  than building a body string. Do not read a file from storage to serve it if a
  link to it would do.
- An in-memory session table, request log or rate limiter grows with traffic
  and never shrinks. Put sessions behind the platform's auth (it already has
  them) and counters in the store.
- Clear timers and listeners you create; an `EventEmitter` that keeps every
  past request's handler is a leak that looks like load.

## When you need to know

`process.memoryUsage()` is the honest answer: `heapUsed` against the ~270 MB
heap, `rss` against 512 MB. Logging it at the start and end of a suspect step
tells you in one run whether the step is the problem. If `heapUsed` climbs
across steps and never comes back down, something is holding on; if a single
step spikes, that step needs breaking up.

The limit itself is not configurable per app today. If you have a workload that
genuinely needs more — a large model run, a heavy transform — tell us; that is
the signal that it should be.

## See also

- [Deploying](../features/deploying.md) — what a deployed app gets
- [Structuring an application](app-structure.md) — keeping actions small
- [File storage](../features/file-storage.md), [The SQL store](../features/sql-store.md)
