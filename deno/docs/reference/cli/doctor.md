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

Exit code = `3` when any check fails (regardless of warnings).

#### JSON

```jsonc
{
  "command": "doctor",
  "workspaceRoot": "/path/to/workspace",
  "checks": [
    {
      "id": "workspace-deno-json",
      "level": "workspace",
      "status": "ok"
    },
    {
      "id": "project-core-pin/my-api",
      "level": "project",
      "project": "my-api",
      "status": "fail",
      "message": "Project pins @skmtc/core@^0.0.148, CLI uses @^0.0.150",
      "remediation": "Update .skmtc/my-api/deno.json#imports to align with the CLI's pin"
    },
    {
      "id": "project-bundle-fresh/my-api",
      "level": "project",
      "project": "my-api",
      "status": "warn",
      "message": "bundle.js older than src/",
      "remediation": "Run `skmtc bundle my-api`"
    }
  ],
  "summary": {
    "ok": 9,
    "warn": 1,
    "fail": 1
  }
}
```

### Status values

- **`ok`** — check passed
- **`warn`** — advisory; the system can still operate (e.g., stale
  bundle.js — `generate` may produce older output)
- **`fail`** — blocking issue; `generate` is likely to misbehave or
  refuse to run

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
fails=$(jq '.summary.fail' doctor-report.json)
if [ "$fails" -gt 0 ]; then
  echo "doctor reported $fails failures"
  exit 1
fi
```

`doctor` exits with code `3` when there are failures, which `set -e`
will catch — the explicit `jq` check is for projects that want to
allow warnings in CI but block on failures.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | All checks passed (warnings allowed) |
| `1` | Internal error running checks (rare) |
| `3` | One or more checks failed |

`doctor` is the one CLI command that uses exit code `3` — chosen to
distinguish "checks ran but found issues" from "the CLI itself
broke" (code `1`).

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
