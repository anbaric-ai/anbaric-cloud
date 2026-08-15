# anbaric-cli

The Anbaric platform CLI. Dependency-light (only `tsx`), hand-rolled
terminal UI, and fully scriptable: **every interactive prompt has a flag**,
so it works identically for humans and for AI agents or CI.

```bash
npm install -g anbaric-cli
```

## Commands

| Command | Purpose |
| --- | --- |
| `anbaric login` | choose a platform and authorize this terminal (browser flow; keypair saved to `~/.anbaric/key.json`) |
| `anbaric logout` | revoke this terminal's key on the platform and remove it locally |
| `anbaric configure [dir]` | create or update the app's `.anbaric/app-config.json` (name + internal port) |
| `anbaric deploy [dir]` | deploy an app; waits until it is live (prompts before replacing a running app) |
| `anbaric update [dir]` | deploy, replacing a running app without prompting |
| `anbaric apps` | list deployed apps |
| `anbaric state-machines` | list registered state machines |
| `anbaric job list [state-machine-id]` | list jobs |
| `anbaric job watch <job-id>` | follow a job's state live |
| `anbaric job set-state <job-id> <state>` | move a job to a state and re-queue it |
| `anbaric job update <job-id> <key=value ...>` | update job properties and re-queue |

## Flags

| Flag | Overrides | Notes |
| --- | --- | --- |
| `--platform-url <url>` | the platform picker | exact URL, highest precedence |
| `--environment <local\|staging\|production>` | the platform picker | derives the URL from the tenant: `local` → `http://localhost:8787`, `staging` → `https://<tenant>.staging.anbaric.ai`, `production` → `https://<tenant>.cloud.anbaric.ai` |
| `--tenant <tenant>` | the tenant prompt | needed with `--environment staging\|production` unless a login already saved one |
| `--yes` | deploy's replace confirmation | equivalent to `update` |
| `--name <name>` | configure's app-name prompt | lowercase letters, numbers, `-`, `_` |
| `--port <port>` | configure's internal-port prompt | 1–65535 |

## Non-interactive usage (agents, CI)

```bash
anbaric configure --name crm --port 3000 ./my-app
anbaric update --environment staging --tenant internal ./my-app
anbaric job set-state 4f1c... approved --environment staging --tenant internal
```

Without a TTY the CLI never prompts: prompts either take their flag value,
fall back to a sensible default, or fail with a message naming the flag to
pass. The one unavoidably interactive step is `login` itself — it opens a
browser for the platform's auth flow (the URL is also printed). After that,
every command authenticates non-interactively.

## How authentication works

`login` opens `<platform>/authorize-cli/<uuid>`; approving in the browser
makes the platform mint an Ed25519 keypair, store the public key, and hand
the private key to the CLI exactly once, together with the **tenant** the
approving session belongs to. Both are saved under `~/.anbaric/`
(`key.json`, mode 600, and `config.json`). Every subsequent request carries
a fresh 60-second EdDSA JWT signed with that key. `logout` revokes the key
server-side and deletes it locally. Keys can also be reviewed and revoked in
the browser at `<platform>/manage-keys`.

The saved tenant is what `--environment` uses to derive platform URLs, so a
typical session is: `anbaric login` once, then plain
`anbaric deploy --environment staging` forever after.
