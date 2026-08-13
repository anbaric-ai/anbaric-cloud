# Anbaric coding standards

Read this before writing or changing any code in this repo.

## Repo shape

npm-workspaces monorepo, plain TypeScript source with no build step (each package's `main`/`types` point at `src/index.ts`):

- `tsapi` — shared contracts and value classes (interfaces like `JobPersistence`, `Queue`; classes like `Job`, `State`, `Transition`). Nothing here depends on the other packages.
- `state-machine` — the public state machine library, with in-memory implementations.
- `anbaric-cloud` — public client library for the hosted API; implements the tsapi interfaces over HTTP.
- `anbaric-cloud-hosting` — the hosted service: Postgres-backed implementations exposed via a `node:http` JSON API.

## Key tenets

**Comment-light code.** Code must be understandable with no comments: descriptive variable, method, and class names carry the meaning. Comments are allowed but rare, and belong above a class or method — not interleaved with the code. Never write comments that narrate what the next line does.

**Small files.** One class (or one cohesive concept) per file, file named after it. Public surface of each package is a `src/index.ts` barrel of `export *` lines.

**Inversion of control.** Depend on the tsapi interfaces, never concrete implementations, and take collaborators as constructor parameters with sensible defaults — e.g. `persistence : JobPersistence = JobPersistenceFactory.instance()`. Environment-based routing lives in factories (`JobPersistenceFactory`, `QueueFactory`, switching on `ANBARIC_*` env vars); copy that pattern for any new pluggable service. Behavior is injected as replaceable function fields (`Action.predicate`/`Action.run`, `PropertyDefinition.validation`, `Transition.predicate`) rather than via subclassing.

## Conventions

- Formatting: 4-space indent, a space before the type-annotation colon (`id : string`), blank line inside class braces before the first member.
- Generics written out: `Array<T>`, `Map<K, V>` — not `T[]`.
- Named exports gathered at the bottom of the file (`export { Thing }`); no default exports.
- Implementations are named by strategy plus interface: `InMemoryJobPersistence`, `PostgresQueue`, `CloudJobPersistence`, `DefaultActionResolver`.
- Keep fields private where possible; expose via getters (`get stateId()`); helper methods private.
- Interfaces whose implementations may cross a process boundary are async: methods return `Promise`, even when an implementation is trivially synchronous.
- Errors are `throw new Error(...)` with a clear human-readable message quoting the offending id or key, e.g. `No job found with id "x"`.
- Env vars are prefixed `ANBARIC_`.

## Testing

- Vitest, run from the root (`npx vitest run` or `npm test`). Every class gets a `test/<ClassName>.test.ts` in its package.
- Small focused `it()` blocks with sentence-style names; helper factories at the top of the file; tests are commentless too.
- Mock collaborators with `vi.fn(async () => ...)` object literals typed via `satisfies`; unit tests assert interactions with the mocks, and a separate `*.integration.test.ts` exercises real in-memory collaborators end to end.
- Network code is tested by booting the real server on an ephemeral port and driving it through the real client (see `anbaric-cloud-hosting/test/HostingServer.test.ts`) — no Postgres required.

## Before finishing any change

Run `npx vitest run` at the root and `npx tsc --noEmit -p <package>` for every package touched; both must be clean.
