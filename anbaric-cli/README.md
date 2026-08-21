# anbaric-cli

The command-line interface for an Anbaric platform: it authorizes a terminal,
deploys and manages apps, and inspects and drives jobs. It publishes as a single
bundled file that runs on plain Node with no runtime dependencies. Every
interactive prompt also has a flag, so the CLI runs unattended in scripts and CI
as well as interactively.

```bash
npm install -g anbaric-cli
```

## Commands

| Command | Purpose |
| --- | --- |
| `anbaric login` | choose a platform and authorize this terminal (browser flow; keypair saved to `~/.anbaric/key.json`) |
| `anbaric logout` | revoke this terminal's key on the platform and remove it locally |
| `anbaric apps` | list deployed apps |
| `anbaric app configure` | create or update the app's `.anbaric/app-config.json` (name + internal port) |
| `anbaric app deploy` | deploy the app; waits until it is live (prompts before replacing a running app) |
| `anbaric app update` | deploy, replacing a running app without prompting |
| `anbaric app status <name>` | show an app's deploy state and whether it is up |
| `anbaric app tail <name>` | stream an app's runtime logs to stdout (Ctrl-C to stop) |
| `anbaric app tear-down <name>` | stop and remove a deployed app (`--yes` to skip the prompt) |
| `anbaric state-machines` | list registered state machines |
| `anbaric jobs create <state-machine-id> <start-state> [key=value ...]` | create a job in the given state machine and queue it for processing |
| `anbaric jobs list [state-machine-id]` | list jobs |
| `anbaric jobs stats` | job counts per state and the queue size |
| `anbaric jobs watch <job-id>` | follow a job's state live |
| `anbaric jobs set-state <job-id> <state>` | move a job to a state and re-queue it |
| `anbaric jobs update <job-id> <key=value ...>` | update job properties and re-queue |
| `anbaric jobs kill <job-id>` | kill a job so it stops progressing |
| `anbaric jobs kill-old <age>` | kill jobs not updated within `<age>` (e.g. `24h`, `7d`) |

The `app configure`/`deploy`/`update` commands operate on the app for the
current project — they walk up from the working directory to the nearest
`package.json`, so they run from anywhere inside it.

## Flags

| Flag | Overrides | Notes |
| --- | --- | --- |
| `-h`, `--help` | — | print the usage screen (also shown for any unknown command or flag) |
| `--platform-url <url>` | the platform picker | exact URL, highest precedence |
| `--environment <local\|staging\|production>` | the platform picker | fixed domains: `local` → `http://localhost:8787`, `staging` → `https://staging.cloud.anbaric.ai`, `production` → `https://cloud.anbaric.ai` |
| `--tenant <tenant>` | nothing (no prompt asks for a tenant) | overrides the tenant the CLI routes to; normally learned automatically at login |
| `--yes` | `app deploy`'s replace confirmation and `app tear-down`'s prompt | for deploy, equivalent to `app update` |
| `--name <name>` | `app configure`'s app-name prompt | lowercase letters, numbers, `-`, `_` |
| `--port <port>` | `app configure`'s internal-port prompt | 1–65535 |

## Non-interactive usage (agents, CI)

```bash
anbaric app configure --name crm --port 3000
anbaric app update --environment staging --tenant internal
anbaric jobs set-state 4f1c... approved --environment staging --tenant internal
```

Without a TTY the CLI never prompts: prompts either take their flag value,
fall back to a sensible default, or fail with a message naming the flag to
pass. The one unavoidably interactive step is `login` itself — it opens a
browser for the platform's auth flow (the URL is also printed). After that,
every command authenticates non-interactively.

## How authentication works

`login` opens `<platform>/authorize-cli/<uuid>`; you complete the
platform's login in the browser (on Anbaric Cloud that includes picking
your organization) and approve the terminal. The platform mints an Ed25519
keypair, stores the public key, and hands the private key to the CLI
exactly once, together with the **tenant** your session belongs to — the
CLI reports "Logged into tenant X" and saves both under `~/.anbaric/`
(`key.json`, mode 600, and `config.json`). Every subsequent request carries
a fresh 60-second EdDSA JWT signed with that key, plus an
`x-anbaric-tenant` header that routes it to your tenant's install.
`logout` revokes the key server-side and deletes it locally; keys can also
be reviewed and revoked in the browser at `<platform>/manage-keys`.

A typical session is: `anbaric login` once, then plain
`anbaric app deploy --environment staging` forever after — the tenant travels
with the key, never with the URL.
