# Anbaric coding standards

Read this before writing or changing any code in this repo.

## Repo shape

npm-workspaces monorepo. The published libraries compile to `dist/` (`main`/`types` point at
`dist/index.js` / `dist/index.d.ts`, `files: ["dist"]`) so consumers get JavaScript plus generated
declarations and never compile our source. Build with `npm run build` at the root (`tsc -b`, wired by
project references in each package's `tsconfig.build.json`); `npm run release` builds before publishing.
Relative imports carry explicit `.js` extensions, as ESM requires. Note this applies to *our packages* —
**customer apps still have no build step**: they ship TypeScript and run under `tsx`.

`tsconfig.json` in each package stays the `--noEmit` typecheck config (source + tests);
`tsconfig.build.json` is the emitting one. Tests run against `src` via aliases in
`vitest.config.ts`, so a build is never required to run them.

The five packages in the `anbaric` graph (`tsapi`, `anbaric-state-machine`, `anbaric-data-store`,
`anbaric-impl-cloud`, `anbaric`) compile. **`anbaric-cloud-hosting` and `anbaric-hosting` deliberately
and permanently ship source** — `anbaric-hosting/bin` resolves
`anbaric-cloud-hosting/src/main.ts`, and `DockerBuildLayer`'s container `CMD` runs
`src/app-admin/launch.ts` under `tsx`, so their published `src/` is an executed runtime path, not just
a compile input. This asymmetry is intended: don't "fix" it. `anbaric-cli` is separate again — esbuild
bundles it to a single `dist/main.js`.

- `tsapi` — shared contracts and value classes (interfaces like `JobPersistence`, `Queue`, `Consumer`, `JsonStore`, `SecretStore`; classes like `Job`, `State`, `Transition`). Nothing here depends on the other packages.
- `anbaric-state-machine` — the public state machine library, with in-memory implementations.
- `anbaric-data-store` — JSON document store (schema-validated) and secret store, with in-memory implementations.
- `anbaric-impl-cloud` — public client library for the hosted API; implements the tsapi interfaces over HTTP.
- `anbaric-cloud-hosting` — the hosted platform: Postgres/AWS-backed implementations exposed via a `node:http` JSON API, plus the build layer, dispatcher, and app proxy.
- `anbaric-cli` — standalone `anbaric` CLI (login/configure/deploy/update/apps/state-machines plus the `job` group: list/watch/set-state/update); dependency-free, hand-rolled terminal UI.
- `anbaric-design-system` — the Anbaric design system (not a workspace): design tokens, brand assets, and the React component library, with a living style guide (`npm run build` there produces a self-contained `dist/index.html`).
- `sample-apps/` — deployable demo apps (not workspaces); they consume the packages the way customer code would.

## Key tenets

**Comment-light code.** Code must be understandable with no comments: descriptive variable, method, and class names carry the meaning. Comments are allowed but rare, and belong above a class or method — not interleaved with the code. Never write comments that narrate what the next line does.

**Small files.** One class (or one cohesive concept) per file, file named after it. Public surface of each package is a `src/index.ts` barrel of `export *` lines.

**Inversion of control.** Depend on the tsapi interfaces, never concrete implementations, and take collaborators as constructor parameters with sensible defaults — e.g. `persistence : JobPersistence = JobPersistenceFactory.instance()`. Environment-based routing lives in factories (`JobPersistenceFactory`, `QueueFactory`, switching on `ANBARIC_*` env vars); copy that pattern for any new pluggable service. Behavior is injected as replaceable function fields (`Action.predicate`/`Action.run`, `PropertyDefinition.validation`, `Transition.predicate`) rather than via subclassing.

## Conventions

- Formatting: 4-space indent, a space before the type-annotation colon (`id : string`), blank line inside class braces before the first member.
- Room to breathe: use newlines to seperate groups of related variables, newlines should generally follow block openings (like `if` or `for`).
- After a bang for a false check use a space: `if (! foo)`.
- Generics written out: `Array<T>`, `Map<K, V>` — not `T[]`.
- Named exports gathered at the bottom of the file (`export { Thing }`); no default exports.
- Implementations are named by strategy plus interface: `InMemoryJobPersistence`, `PostgresQueue`, `CloudJobPersistence`, `DefaultActionResolver`.
- Keep fields private where possible; expose via getters (`get stateId()`); helper methods private.
- Interfaces whose implementations may cross a process boundary are async: methods return `Promise`, even when an implementation is trivially synchronous.
- Errors are `throw new Error(...)` with a clear human-readable message quoting the offending id or key, e.g. `No job found with id "x"`.
- Env vars are prefixed `ANBARIC_`.

## Front-end

- All front-end code is React — no other UI frameworks, and no plain-DOM UIs beyond trivial served pages.
- Every UI must use and follow the design system (`anbaric-design-system`): import its tokens (`tokens.css`) and build with its tokens for colour, spacing, radius, elevation, and typography — never hardcode values the tokens cover.
- Strongly favour existing components from the component library over writing new ones. Before creating a component, check the library; if something close exists, extend it via props or tokens rather than forking. New genuinely-reusable components belong in the design system (one folder per component: `<Name>.tsx`, `<Name>.css`, `index.ts`), not in the consuming app.

## Testing

- Vitest, run from the root (`npx vitest run` or `npm test`). Every class gets a `test/<ClassName>.test.ts` in its package.
- Small focused `it()` blocks with sentence-style names; helper factories at the top of the file; tests are commentless too.
- Mock collaborators with `vi.fn(async () => ...)` object literals typed via `satisfies`; unit tests assert interactions with the mocks, and a separate `*.integration.test.ts` exercises real in-memory collaborators end to end.
- Network code is tested by booting the real server on an ephemeral port and driving it through the real client (see `anbaric-cloud-hosting/test/HostingServer.test.ts`) — no Postgres required.

## Before finishing any change

Run `npx vitest run` at the root and `npx tsc --noEmit -p <package>` for every package touched; both must be clean.
If you touched a published library (`tsapi`, `anbaric-state-machine`, `anbaric-data-store`,
`anbaric-impl-cloud`, `anbaric`), also run `npm run build` — the emit is stricter than the typecheck,
and a missing `.js` on a relative import only fails there.

## Releasing

The root `package.json` `version` is the single source for every workspace:
`npm run versions` stamps it into all packages and aligns inter-`anbaric`
dependencies to `^<version>`. To release: bump the root version, then
`npm run release` (versions → build → tests → `npm publish --workspaces`, which
skips the private Auth0 package). Never edit workspace versions by hand.

Publishing must pass `--tag latest` explicitly, which `npm run release` does. A stray `2.0.0` was
once published to eight of the packages; it is past npm's unpublish window, so it stays the highest
version for ever, and npm refuses to move the `latest` tag *implicitly* onto a lower version. Without
the flag every publish fails with "Cannot implicitly apply the latest tag". Don't publish these
packages with a bare `npm publish`.
