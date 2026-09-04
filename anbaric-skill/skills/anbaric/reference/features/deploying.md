# Deploying

The same app you run locally deploys to Anbaric Cloud with one command. There's
no build step and no infrastructure to configure — you ship source, the platform
runs it.

## Deploy

From anywhere inside your project:

```bash
anbaric login          # one-time: choose a platform, authorize this terminal
anbaric app deploy     # package the app and wait until it is live
```

`app deploy` uploads your source, the platform installs the app's dependencies
and runs it, and the command returns once the app answers its liveness check.
Then watch it work:

```bash
anbaric apps                    # your deployed apps and their status
anbaric jobs list               # jobs and their states
anbaric jobs watch <job-id>     # follow a job as it progresses
```

## What your app must provide

- **`package.json`** with `"type": "module"` and `main` pointing at your entry
  file (e.g. `src/main.ts`).
- **`.anbaric/app-config.json`** with a `name` and an `internalPort`:

  ```json
  { "name": "crm", "internalPort": 3000 }
  ```

  `name` is lowercase letters, digits, `-` and `_`; `internalPort` is the port
  your app listens on (`process.env.PORT`). `anbaric app configure` creates this
  file, and `app deploy` prompts if it's missing.

## What deployment does (and doesn't)

- **No build step.** `npm run build` is never run — your TypeScript is executed
  directly with `tsx`. **Ship source, not `dist/`.**
- **Dependencies are installed for you.** Only your source is uploaded
  (`node_modules` is excluded); the platform runs `npm install` at build time, so
  any npm package you import works when deployed.
- **Wiring is injected.** The platform sets the `ANBARIC_*` variables that point
  the factories at platform-backed persistence, queueing, stores and auditing —
  so your code is identical locally and in the cloud. **Never set these
  yourself.** See [Environment and factories](../api/environment.md).

## Updating and tearing down

```bash
anbaric app update            # redeploy over a running app without prompting
anbaric app status <name>     # deploy state, liveness, recent logs
anbaric app tail <name>       # stream runtime logs
anbaric app tear-down <name>  # stop and remove the app
```

## Running your own platform

You don't have to use Anbaric Cloud — `anbaric-hosting` runs the whole platform
(API, dispatcher, build layer and proxy) on infrastructure you operate, backed by
Postgres. Point the CLI at it with `--platform-url` (or `anbaric login` and pick
it). Everything in this guide works the same way.

## Next

- [CLI reference](../api/cli.md) — every command and flag
- [Structuring an application](../patterns/app-structure.md)
