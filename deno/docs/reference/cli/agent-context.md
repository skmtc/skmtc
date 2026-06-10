# skmtc agent-context

> Write a structured project state dump designed for consumption by
> AI agents. Unlike `doctor` (which classifies checks as pass/fail),
> `agent-context` provides raw state — installed generators, schema
> location, recent generation history, etc. — for an agent to reason
> about.

`agent-context` is the CLI's "tell me everything you know about the
workspace" command. It's the recommended starting point for agents
beginning a SKMTC-related task: a single JSON document describing
what the workspace looks like, what generators are present, where
the spec lives, and what the last successful generation produced.

## Synopsis

```
skmtc agent-context [--json]
```

Like `doctor`, takes no positional arguments — always operates on
the current workspace.

## Options

### `--json`

Write structured JSON output to stdout. Strongly recommended for
agent use.

`agent-context` only defines `--json`; it has no `--no-input` flag
(the command is non-interactive by nature). Without `--json`, the
CLI writes a human-readable summary table; the JSON form is the
canonical interface, the human form is for spot-checking.

## Behavior

### Information included

The output is organized into top-level keys:

#### `workspace`

Workspace-level metadata:

```jsonc
{
  "workspace": {
    "root": "/path/to/workspace",
    "denoVersion": "1.46.3",
    "cliVersion": "0.0.150",
    "corePin": "@skmtc/core@^0.0.150"
  }
}
```

- **`root`** — absolute path to the workspace root.
- **`denoVersion`** — output of `deno --version`.
- **`cliVersion`** — the CLI's own version (matches its package).
- **`corePin`** — the `@skmtc/core` version the CLI is pinned to.

#### `projects`

Array of per-project state:

```jsonc
{
  "projects": [
    {
      "name": "my-api",
      "schema": {
        "url": "https://api.example.com/openapi.json",
        "lastFetched": "2026-05-12T08:15:00Z"
      },
      "generators": [
        {
          "name": "@skmtc/gen-zod",
          "source": "jsr",
          "version": "^0.0.55"
        },
        {
          "name": "@local/my-form",
          "source": "local",
          "path": "./my-form/mod.ts"
        }
      ],
      "bundle": {
        "present": true,
        "path": ".skmtc/my-api/bundle.js",
        "mtime": "2026-05-12T08:20:00Z"
      },
      "lastGenerate": {
        "timestamp": "2026-05-12T08:22:00Z",
        "durationMs": 1850,
        "artifactCount": 47,
        "diagnostics": {
          "errors": 0,
          "warnings": 2
        }
      },
      "settings": {
        "basePath": "src/generated",
        "enrichmentsConfigured": true,
        "skipCount": 0,
        "excludeCount": 1
      }
    }
  ]
}
```

#### `anomalies`

A short list of detected anomalies — issues that aren't full
diagnostics-level failures but that an agent might want to surface:

```jsonc
{
  "anomalies": [
    {
      "kind": "stale-bundle",
      "project": "my-api",
      "detail": "bundle.js older than src/my-form/"
    },
    {
      "kind": "missing-operationId",
      "project": "my-api",
      "detail": "12 operations in spec have no operationId"
    }
  ]
}
```

Anomalies overlap with `doctor` warnings but are oriented toward
"things an agent might want to mention to the user" rather than
"things to fix before generating."

### Output format

The complete shape:

```jsonc
{
  "command": "agent-context",
  "workspace": { ... },
  "projects": [ ... ],
  "anomalies": [ ... ],
  "verifyWith": "skmtc list <project> --json"
}
```

The full document is intended to be embedded in an agent's context
window for it to reason about. Typical size: 2–10 KB for small
workspaces, up to ~50 KB for large multi-project workspaces.

## Examples

### Bootstrap an agent session

```bash
skmtc agent-context --json > skmtc-state.json
```

Then the agent can read `skmtc-state.json` at the start of its
session to orient.

### Filter to one project's generators

```bash
skmtc agent-context --json | jq '.projects[] | select(.name == "my-api") | .generators'
```

### Detect stale bundle and remediate

```bash
state=$(skmtc agent-context --json)
stale=$(echo "$state" | jq '.anomalies[] | select(.kind == "stale-bundle") | .project')

if [ -n "$stale" ]; then
  echo "Rebundling stale projects: $stale"
  echo "$stale" | xargs -I {} skmtc bundle {}
fi
```

## How `agent-context` differs from `doctor`

| Aspect | `doctor` | `agent-context` |
|--------|----------|-----------------|
| **Purpose** | Pass/fail health checks | Raw state dump |
| **Output orientation** | Remediation-focused | Information-focused |
| **Output size** | Small, focused on failures | Larger, comprehensive |
| **Exit code** | Non-zero on failure | Always `0` (informational) |
| **Typical consumer** | CI gates, "is this broken?" checks | Agent reasoning, dashboards |

Run both: `doctor` to gate execution, `agent-context` to inform
decisions.

## What `agent-context` does *not* include

- **OAS schema contents** — too large; the URL is provided so an
  agent can fetch separately.
- **Generated artifact contents** — also too large; the count and
  diagnostics summary are enough for orientation.
- **Generator source code** — agents can read those files directly
  if needed.
- **Secrets** — the CLI explicitly redacts any `Authorization`
  headers or API keys from the schema-fetch metadata.

The principle: include what an agent needs to *orient*, not
everything an agent might *ever* need.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — context written (may be empty if no projects) |
| `1` | Internal error gathering context |

Unlike `doctor`, `agent-context` doesn't have a "found issues" exit
code — anomalies are reported in-band as part of the output.

## Common failure modes

### Not in a workspace

```
Error: not in a SKMTC workspace (no deno.json found)
```

`cd` to a SKMTC workspace root, or run `skmtc init` to create one.

### Schema fetch timeout

The `schema.lastFetched` field may be absent if the CLI's last
fetch attempt timed out. Not a `doctor` failure — the spec could
have been temporarily down — but the agent should treat the absence
as a soft signal.

### Bundle metadata unavailable

If `bundle.present` is `false` and `bundle.path` is absent, the
project has never been bundled. Every project — remote-only
included — needs a `bundle.js` to generate; run
`skmtc bundle <project>` to build it.

## See also

- [`skmtc doctor`](doctor.md) — pass/fail health checks
- [`skmtc list`](list.md) — focused generator inventory
- [`skmtc-debug` skill](../../skills/skmtc-debug/SKILL.md) — how to
  use `agent-context` during debugging sessions
- [`skmtc-cli` skill](../../skills/skmtc-cli/SKILL.md) — broader
  CLI workflow
