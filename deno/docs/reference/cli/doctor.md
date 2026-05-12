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
skmtc doctor [--json]
```

The command takes no positional arguments — it always operates on
the current workspace and all its projects.

## Options

### `--json`

Emit structured JSON output. Without it, the CLI produces a
human-readable check-by-check report.

`doctor` is one of the most common commands consumed via `--json`
by agents — the structured form is designed for programmatic
remediation.

## Behavior

### Checks performed

Each check has an ID, a target (workspace or project), and a
pass/fail result. Failures include a remediation hint.

#### Workspace-level checks

| Check ID | What it verifies |
|---|---|
| `workspace-deno-json` | Workspace root has a valid `deno.json` |
| `workspace-client-json` | Workspace `client.json` (if present) is valid against the schema |
| `cli-core-pin` | CLI's pinned `@skmtc/core` version is current (advisory) |
| `node-runtime` | Deno version meets the CLI's minimum (advisory) |

#### Per-project checks

For each project under `.skmtc/<project>/`:

| Check ID | What it verifies |
|---|---|
| `project-deno-json/<project>` | `<project>/deno.json` exists and is valid |
| `project-client-json/<project>` | `<project>/client.json` (if present) is valid against the schema |
| `project-core-pin/<project>` | The project's `@skmtc/core` import pin matches the CLI's |
| `project-schema-fetch/<project>` | The spec URL in `client.json#schema.url` (or `path`) is reachable |
| `project-bundle/<project>` | `bundle.js` is present (only when project has clones/local generators) |
| `project-bundle-fresh/<project>` | `bundle.js` is newer than the source it depends on (advisory) |
| `project-installs/<project>` | Every `deno.json#imports` entry resolves (no missing JSR versions, no broken local paths) |
| `project-generators-loadable/<project>` | Each generator's Entry can be loaded without throwing |

The exact set of checks evolves over time. Run `skmtc doctor` itself
to see the current battery.

### Output format

#### Human-readable

```
Workspace: /path/to/workspace

✓ workspace-deno-json          OK
✓ workspace-client-json        OK
✓ cli-core-pin                 OK (@skmtc/core 0.0.150)

Project: my-api

✓ project-deno-json/my-api          OK
✓ project-client-json/my-api        OK
✗ project-core-pin/my-api           FAIL
    Project pins @skmtc/core@^0.0.148, CLI uses @^0.0.150
    Remediation: update .skmtc/my-api/deno.json#imports
✓ project-schema-fetch/my-api       OK
✓ project-bundle/my-api             OK
○ project-bundle-fresh/my-api       WARN
    bundle.js older than src/; run `skmtc bundle my-api`
✓ project-installs/my-api           OK

Summary: 9 OK, 1 WARN, 1 FAIL
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
      "id": "shim-lockfile",
      "status": "ok",
      "message": "Shim lockfile present. Pinned: @skmtc/cli=0.0.150, @skmtc/core=0.0.150.",
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
      "message": "bundle.js older than src/",
      "hint": "Run `skmtc bundle my-api`"
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
skmtc doctor --json | jq '.checks[] | select(.status == "fail")'
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
input recipe errors emitted by other commands.

## Common failure modes

### Workspace not initialized

```
✗ workspace-deno-json    FAIL
    No deno.json found in workspace root
    Remediation: run `skmtc init <project>` to bootstrap the workspace
```

You're not in a SKMTC workspace. `cd` to the workspace root or run
`init` to create one.

### Core pin mismatch

```
✗ project-core-pin/my-api    FAIL
    Project pins @skmtc/core@^0.0.148, CLI uses @^0.0.150
```

The project's pinned `@skmtc/core` version doesn't match the CLI's.
Mostly cosmetic — minor-version drift usually still works — but
major-version drift can break generation. Update the project's
`deno.json` to align.

### Schema unreachable

```
✗ project-schema-fetch/my-api    FAIL
    GET https://api.example.com/openapi.json returned 404
```

The OAS spec URL in `client.json#schema.url` isn't reachable. Check
the URL, your network, or whether the spec endpoint requires auth.

### Stale bundle

```
○ project-bundle-fresh/my-api    WARN
    bundle.js older than src/
```

A clone or local generator's source has changed since the last
bundle. Run `skmtc bundle <project>` to refresh. The next `generate`
will use the stale bundle — you'll miss your latest changes.

## See also

- [`skmtc agent-context`](agent-context.md) — broader project state
  dump for agents
- [`skmtc list`](list.md) — focused inventory of installed generators
- [`skmtc bundle`](bundle.md) — fix `project-bundle-fresh` warnings
- [Reference: client.json schema](../settings/client-json-schema.md) —
  what `project-client-json` validates against
- [skmtc-debug skill](../../skills/skmtc-debug/SKILL.md) — broader
  debugging workflow for engine failures
