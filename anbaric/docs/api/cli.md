# API — CLI reference

The `anbaric` command authorizes your terminal against a platform, deploys apps,
and inspects and drives their jobs. Install it globally:

```bash
npm install -g anbaric-cli
```

After a one-time `anbaric login`, the `app` commands run from anywhere inside a
project — they walk up to the nearest `package.json`.

## Authentication

| Command | Purpose |
| --- | --- |
| `anbaric login` | Choose a platform and authorize this terminal (browser flow; keypair saved to `~/.anbaric/`). |
| `anbaric logout` | Revoke this terminal's key on the platform and delete the local keypair. |

## Apps

| Command | Purpose |
| --- | --- |
| `anbaric apps` | List deployed apps (name, status, port). |
| `anbaric app configure` | Create or update `.anbaric/app-config.json` (`name`, `internalPort`). |
| `anbaric app deploy` | Deploy the app and wait until it is live (prompts before replacing a running one). |
| `anbaric app update` | Deploy, replacing a running app **without** prompting. |
| `anbaric app status [name]` | Show deploy state, liveness, and recent logs. |
| `anbaric app tail [name]` | Stream the app's runtime logs. |
| `anbaric app tear-down [name]` | Stop and remove the app (prompts unless `--yes`). |

The name is optional, because an `app` command is normally about the app you
are standing in: the CLI walks up from the working directory to the nearest
`package.json` and takes the name from that project's
`.anbaric/app-config.json`, falling back to the package's own `name`. Pass a
name to act on a different app, or to work from outside a project entirely.

```bash
cd ~/work/crm && anbaric app tail       # the app you are in
anbaric app status link-media-brief     # a different app, from anywhere
```

## State machines and jobs

| Command | Purpose |
| --- | --- |
| `anbaric state-machines` | List registered state machines. |
| `anbaric jobs create <sm-id> <start-state> [k=v …]` | Create a job and queue it for processing. |
| `anbaric jobs list [state-machine-id]` | List jobs, optionally filtered by workflow. |
| `anbaric jobs stats` | Job counts per state and the queue size. |
| `anbaric jobs watch <job-id>` | Follow a job's state and property changes live. |
| `anbaric jobs set-state <job-id> <state>` | Move a job to a state and re-queue it. |
| `anbaric jobs update <job-id> <k=v …>` | Update job properties and re-queue. |
| `anbaric jobs kill <job-id>` | Kill a job so it stops progressing. |
| `anbaric jobs kill-old <age>` | Kill jobs not updated within `<age>` (e.g. `24h`, `7d`; units `s`/`m`/`h`/`d`/`w`). Prompts unless `--yes`. |

## Flags

Every command accepts these; they supply the answers a prompt would otherwise
ask for, so the CLI runs unattended in scripts and CI.

| Flag | Applies to | Notes |
| --- | --- | --- |
| `--platform-url <url>` | all | The platform to talk to. Falls back to `ANBARIC_CLOUD_URL`, stored config, then `http://localhost:8787`. |
| `--environment <local\|staging\|production>` | all + `login` | Shorthand for a platform URL (`local` → localhost:8787). |
| `--tenant <tenant>` | all | Target tenant. Falls back to `ANBARIC_TENANT`, then stored config. |
| `--name <name>` | `app configure`/`deploy`/`update` | App name; prompts if omitted (suggested from `package.json`). |
| `--port <port>` | `app configure`/`deploy`/`update` | Internal port (1–65535); prompts if omitted. |
| `--yes` | `app deploy`, `app tear-down`, `jobs kill-old` | Skip confirmation. (`app update` implies it.) |
| `--help`, `-h` | all | Print usage. |

## Configuration and storage

The CLI stores config under `~/.anbaric` (override with `ANBARIC_CONFIG_DIR`):
`config.json` holds the platform URL and tenant; `key.json` (mode `0600`) holds
your authorized keypair. Manage your keys in the browser at
`<platform>/manage-keys`.

The CLI also reads `ANBARIC_CLOUD_URL` and `ANBARIC_TENANT` from the environment
as defaults.

## See also

- [Deploying](../features/deploying.md)
- [Build your first app](../patterns/first-app.md)
