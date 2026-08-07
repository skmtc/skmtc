# skmtc doctor

> Run health-check diagnostics on a SKMTC workspace. Reports issues
> with project setup, configuration files, generator pins, and
> filesystem state.

`doctor` is the "is everything wired up correctly?" command. It runs
a battery of checks across the workspace and each project, reporting
failures with structured remediation hints. Use it after `install`,
before `generate`, or when diagnosing a confusing failure.

## Synopsis

```
skmtc doctor [--json] [--offline]
```

The command takes no positional arguments — it always operates on
the current workspace and all its projects.

## Options

### `--json`

Write structured JSON output to stdout. Without it, the CLI produces
a human-readable check-by-check report.

`doctor` is one of the most common commands consumed via `--json`
by agents — the structured form is designed for programmatic
remediation.

### `--offline`

Skip the registry lookup behind `cli-version-current`, which then
reports `skipped`. Every other check is filesystem-only, so this makes
the whole command network-free. Without it the lookup is bounded at 2
seconds and degrades to `skipped` anyway — use `--offline` when a run
already knows it has no network and does not want to spend the timeout
being told so.

## Behavior

### Checks performed

Each check has an ID, a target (workspace or project), and a
pass/fail result. Failures include a remediation hint.

The full surface is enumerated in `cli/lib/doctor-headless.ts` and
`cli/lib/doctor-anchors.ts` — every `id:` literal. A test asserts that
each one appears in this table, so a check added without a row here
fails the suite. Workspace-scoped checks plus per-project checks:

#### Workspace-level checks

| Check ID | What it verifies |
|---|---|
| `cli-version-current` | The running CLI against the newest published `@skmtc/cli`. The only check that reaches the network (2s bound; `skipped` when unreachable, and `skmtc doctor --offline` skips the lookup outright). When the newest release is still inside Deno's 24h minimum-dependency-age window, the hint says so — a reinstall without `--minimum-dependency-age=0` silently resolves an older release. |
| `install-lockfile` | The installed CLI's `deno.lock` (under `~/.deno/bin/.skmtc/`) exists and pins `@skmtc/cli` and `@skmtc/core` to compatible versions |
| `deno-version` | The running Deno satisfies the `>= 2.4.0` floor for the esbuild-based `deno bundle` |
| `hub-auth` | `~/.skmtc/auth.json` (written by `skmtc login`) parses to the expected `{ host, token }` shape. Offline only — no network call; `skipped` when not logged in, `warning` with a logout/login hint when malformed. Reports at most the token's last 4 characters. |

#### Per-project checks

For each project under `.skmtc/<project>/`:

| Check ID | What it verifies |
|---|---|
| `project-deno-json/<project>` | `<project>/deno.json` exists and parses as JSON |
| `project-base-path/<project>` | `<project>/client.json#settings.basePath` is set and **relative** (absolute paths fail) |
| `project-core-pin/<project>` | The project's `@skmtc/core` import pin matches the CLI's |
| `project-bundle/<project>` | If the project has at least one *local* generator import, `bundle.js` exists. Pure JSR projects return `ok` with `hasLocalGenerator: false` (no bundle needed). |
| `project-manifest/<project>` | `manifest.json` (if present) parses and matches the schema the current `@skmtc/core` expects |
| `project-enrichments/<project>` | The last generate's `manifest.enrichmentWarnings` has no `warning`-level entries — dead enrichment config (typo'd generator ids, paths, methods, model names; schema-dropped keys) surfaces here between runs. `info` entries (enrichments on deliberately skipped items) keep the check `ok`. Skips when the manifest is missing, broken (deferred to `project-manifest`), or written by a core older than 0.28.0. |
| `project-worker-pin/<project>` | The project pins `@skmtc/worker` — the generated `worker.ts` needs it to bundle. `skipped` before the first `skmtc bundle` writes `worker.ts`; `warning` with a `skmtc bundle` hint when the pin is missing. |
| `anchors-config/<project>` | `client.json#settings.anchors` parses and reports whether gen-maps are enabled (opt-in via `settings.anchors.enabled`) and where they are written. |
| `anchors-coverage/<project>` | Share of the manifest's files that have an attribution sidecar; `warning` below the coverage threshold. `skipped` when anchors are disabled or the project has not generated yet. |
| `anchors-staleness/<project>` | Sidecars on disk are current for the last run. `skipped` when anchors are disabled or no manifest exists. |

The exact set of checks evolves over time. Run `skmtc doctor` itself
to see the current battery.

### Output format

#### Human-readable

```
Workspace: /path/to/workspace

✓ install-lockfile             OK (cli=0.0.150, core=0.0.150)

Project: my-api

✓ project-deno-json/my-api          OK
✓ project-base-path/my-api          OK (basePath="mobile-app/src")
✗ project-core-pin/my-api           FAIL
    Project pins @skmtc/core@^0.0.148, CLI uses @^0.0.150
    Remediation: update .skmtc/my-api/deno.json#imports
○ project-bundle/my-api             WARN
    bundle.js missing; run `skmtc bundle my-api`
✓ project-manifest/my-api           OK

Summary: 4 OK, 1 WARN, 1 FAIL
```

Exit code = `1` when any check fires at `error` severity. Warnings
do not change the exit code.

#### JSON

```jsonc
{
  "skmtcRootPath": "/path/to/workspace/.skmtc",
  "globalStateDir": "/home/user/.skmtc",
  "cliVersion": "0.0.150",
  "projects": ["my-api"],
  "checks": [
    {
      "id": "install-lockfile",
      "status": "ok",
      "message": "Install lockfile present. Pinned: @skmtc/cli=0.0.150, @skmtc/core=0.0.150.",
      "data": { "lockPath": "/home/user/.deno/bin/.skmtc/deno.lock", "cliVersion": "0.0.150", "coreVersion": "0.0.150" }
    },
    {
      "id": "project-core-pin/my-api",
      "status": "error",
      "message": "Project pins @skmtc/core@^0.0.148, CLI uses @^0.0.150",
      "hint": "Update .skmtc/my-api/deno.json#imports to align with the CLI's pin"
    },
    {
      "id": "project-bundle/my-api",
      "status": "warning",
      "message": "Project \"my-api\" has local generators but no bundle.js at .skmtc/my-api/bundle.js.",
      "hint": "Run `skmtc bundle my-api` to build it.",
      "data": { "hasLocalGenerator": true, "bundlePath": ".skmtc/my-api/bundle.js" }
    },
    {
      "id": "project-manifest/my-api",
      "status": "ok",
      "message": "Project \"my-api\" manifest matches the current @skmtc/core schema."
    }
  ],
  "summary": "error"
}
```

Each `Check` has the shape `{ id, status, message, hint?, data? }`.
There is no separate `level` or `remediation` field — remediation
text lives in `hint`, and the check's scope (workspace vs project)
is encoded in the `id` (project-scoped check IDs end with
`/<projectName>`). The top-level `summary` is itself a
`CheckStatus` (`ok` / `warning` / `error` / `skipped`) — the
aggregate is `error` if any check is `error`, otherwise `warning`
if any is `warning`, otherwise `ok`.

### Status values

- **`ok`** — check passed
- **`warning`** — advisory; the system can still operate (e.g.,
  stale `bundle.js` — `generate` may produce older output)
- **`error`** — blocking issue; `generate` is likely to misbehave
  or refuse to run
- **`skipped`** — the check did not run (e.g., a per-project check
  on a non-existent project, or a freshness check on a project
  with no clones)

### Remediation hints

Each non-OK check includes a `remediation` string. These are
machine-parseable: agents can dispatch on the remediation text or
include it directly in user-facing error messages.

When the remediation is a runnable command, `doctor` prefers
formatting it as a backticked shell line (e.g.,
`` Run `skmtc bundle my-api` ``) so it's both readable and easy to
extract.

## Examples

### Quick check

```bash
skmtc doctor
```

### Agent consumption

```bash
skmtc doctor --json | jq '.checks[] | select(.status == "error")'
```

Pulls just the failing checks for remediation.

### CI integration

```bash
#!/bin/bash
set -e
skmtc doctor --json > doctor-report.json
summary=$(jq -r '.summary' doctor-report.json)
if [ "$summary" = "error" ]; then
  echo "doctor reported error-severity checks; see doctor-report.json"
  exit 1
fi
```

`doctor` exits with code `1` when there's an error-level check
fire, which `set -e` will catch — the explicit `jq` check above
is redundant for that case but useful when you want a more
informative message before failing.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Doctor ran; no `error`-severity checks fired (warnings allowed) |
| `1` | At least one `error`-severity check fired |

`doctor` collapses both "internal failure to run a check" and
"a check ran and reported error severity" onto exit `1`. Use the
JSON output to distinguish: a real check failure carries
`status: "error"` in `.checks[]`; an internal failure typically
manifests as a stderr message with no JSON envelope. `doctor`
never returns exit code `2` — that code is reserved for missing-
input recipe errors written by other commands.

## Common failure modes

### Install lockfile missing

```
✗ install-lockfile    FAIL
    The installed CLI's deno.lock not found
```

The CLI was installed in a way that didn't produce an install
lockfile (or it has been deleted). Reinstall via the documented
`deno compile` path (see the CLI installation notes) so the install
lockfile is regenerated.

### Core pin mismatch

```
✗ project-core-pin/my-api    FAIL
    Project pins @skmtc/core@^0.0.148, CLI uses @^0.0.150
```

The project's pinned `@skmtc/core` version doesn't match the CLI's.
Mostly cosmetic — minor-version drift usually still works — but
major-version drift can break generation. Update the project's
`deno.json` to align.

### basePath missing or absolute

```
✗ project-base-path/my-api    FAIL
    Project "my-api" has an absolute basePath: /Users/x/app/src
```

`client.json#settings.basePath` is either unset or absolute.
`basePath` must be relative to the SKMTC root. Edit `client.json`
or re-run `skmtc init` with a relative path.

### Bundle missing

```
○ project-bundle/my-api    WARN
    bundle.js missing
```

The project has at least one local generator (a clone, or any
import that isn't `jsr:...`) but no `bundle.js` is present.
Run `skmtc bundle <project>` to build it. Remote-only projects
report `ok` here — no bundle needed when every generator is on
JSR.

### Stale manifest

```
○ project-manifest/my-api    WARN
    manifest.json is not valid JSON
```

The on-disk `manifest.json` is malformed or has drifted from the
schema the current `@skmtc/core` expects. The runtime tolerates a
stale manifest but cleanup of previous artifacts will be skipped
on the next run. Run `skmtc generate <project>` to rewrite it.

### Enrichment warnings from the last run

```
○ project-enrichments/my-api    WARN
    Project "my-api" last generate reported 1 enrichment warning(s):
    enrichment entry '@skmtc/gen-shadcn-form → /pet → post' was never
    consumed — no matching generator or subject in this run
    (did you mean '/pets'?)
```

The last generate's consumption audit found enrichment config the
engine never read — a typo'd routing key or an entry orphaned by
schema evolution — or leaf keys the generator's schema silently
dropped. Fix the flagged keys in
`.settings/client.json#settings.enrichments` and re-run
`skmtc generate <project>`. The full structured list (including
`info` entries) is in the check's `data.enrichmentWarnings` and in
`manifest.enrichmentWarnings` — see
[the manifest format](../manifest-format.md) for the
`EnrichmentWarning` shape.

## See also

- [`skmtc agent-context`](agent-context.md) — broader project state
  dump for agents
- [`skmtc list`](list.md) — focused inventory of installed generators
- [`skmtc bundle`](bundle.md) — rebuild `bundle.js` when `project-bundle/<project>` warns
- [Reference: client.json schema](../settings/client-json-schema.md) —
  the schema `project-base-path` reads `settings.basePath` from
- [How to debug a failing generation](../../using/how-to/debug-failing-generation.md) — broader
  debugging workflow for engine failures
