# CLI overview

> The `skmtc` CLI's command surface, conventions, and shared flags.
> Quick navigation to every command, plus the conventions every
> command obeys.

The CLI is the orchestration layer around the [engine](../api/to-artifacts.md).
It bootstraps projects, manages generator installation, runs the
worker, and reports diagnostics. Every command writes structured
JSON output behind `--json` so agents can consume it programmatically.

## Synopsis

```
skmtc <command> [args...] [--json] [--no-input]
```

The CLI is installed via Deno's `install` mechanism, then invoked as
`skmtc` from any shell. The entry point is `skmtc/deno/cli/mod.ts`.

## Command list

### Project lifecycle

| Command | Purpose | Reference |
|---------|---------|-----------|
| `init` | Initialize a new SKMTC workspace | [init](init.md) |
| `create` | Scaffold a new local generator from scratch | [create](create.md) |
| `clone` | Fork an existing JSR generator into the project | [clone](clone.md) |
| `install` | Add a JSR-hosted generator to the project | [install](install.md) |
| `list` | Show installed generators in a project | [list](list.md) |
| `remove` | Remove a generator from a project | [remove](remove.md) |

### Generation

| Command | Purpose | Reference |
|---------|---------|-----------|
| `generate` | Run the engine end-to-end on a project's spec | [generate](generate.md) |
| `bundle` | Rebuild the project's `bundle.js` (worker payload) | [bundle](bundle.md) |
| `dev` | Watch mode for iterative generator development | [dev](dev.md) |

### Diagnostics

| Command | Purpose | Reference |
|---------|---------|-----------|
| `doctor` | Diagnose project setup issues | [doctor](doctor.md) |
| `agent-context` | Write a structured project state dump for AI agents | [agent-context](agent-context.md) |

## Shared flags

### `--no-input`

Disables interactive prompts. Commands that prompt for missing
arguments (e.g., "which project?", "which generator?") will exit
with code 2 instead.

Use in scripts, CI, and agent workflows where TTY-style interaction
isn't possible or desirable.

### `--json`

Writes structured JSON to stdout instead of human-readable text.

**Implies `--no-input`** — JSON output is incompatible with
interactive prompting (a prompt would corrupt the JSON stream).

The exact JSON shape is documented per-command. Common fields across
commands:

```jsonc
{
  "command": "install",
  "projectName": "my-api",
  // ... command-specific fields
  "verifyWith": "cat .skmtc/my-api/deno.json"
}
```

Many commands include a `verifyWith` field — a follow-up shell
command an agent can run to confirm the operation landed. This is a
key affordance for agentic workflows where the CLI is one tool among
many.

## Strict mode

When `--no-input` (or `--json`) is set, the CLI runs in **strict
mode**:

- Required arguments not provided on the command line cause exit
  code 2 (rather than prompting)
- No interactive disambiguation (e.g., "we found multiple matches,
  pick one")
- Errors are reported as structured JSON when `--json` is set

This makes the CLI's behavior fully deterministic and scriptable.

## Exit codes

The CLI uses a consistent exit-code convention across commands:

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Operational failure (network, filesystem, validation) |
| `2` | Invalid invocation (missing args, unknown flags) |

`doctor` collapses "internal failure" and "a check ran at error
severity" onto exit `1` — it does not use a distinct exit code
for diagnostics failures.

Per-command pages document which codes apply.

## Project layout assumed by the CLI

```
workspace-root/
├── deno.json                          # workspace deno.json
├── .skmtc/
│   └── <project>/
│       ├── deno.json                  # per-project generator imports
│       ├── .settings/
│       │   ├── client.json            # per-project settings (source, basePath, enrichments)
│       │   └── manifest.json          # last-run manifest (written by generate)
│       ├── bundle.js                  # generated worker payload
│       └── <generator>/               # cloned or created generator source
│           ├── deno.json
│           ├── mod.ts
│           └── src/
└── (your application code)
```

The `.skmtc/` directory is the CLI's working area. Each subdirectory
is a separate "project" — a logical bundle of generators applied to
one spec. Most workspaces have one project; multi-project workspaces
exist when one repo produces multiple sets of artifacts.

## Configuration files

The CLI reads (and sometimes writes) these files:

| File | Purpose |
|------|---------|
| `deno.json` (workspace root) | Workspace-level configuration |
| `.skmtc/<project>/deno.json` | Per-project generator imports |
| `.skmtc/<project>/.settings/client.json` | Per-project generation settings (source, basePath, enrichments) |
| `.skmtc/<project>/.settings/manifest.json` | Last-run manifest |
| `<generator>/deno.json` | Per-generator package metadata |

See [reference/settings/client-json-schema.md](../settings/client-json-schema.md)
for the `client.json` schema.

## Command conventions

### Project argument

Most commands take `[project]` as an optional positional argument.
Resolution order:

1. Explicit `[project]` argument
2. Single-project workspace: the project name is inferred
3. Interactive prompt (only if not in strict mode)
4. Strict mode without arg → exit code 2

### Generator argument

Generator specifiers can be:

- Bare package names: `@skmtc/gen-zod`
- With semver: `@skmtc/gen-zod@^0.0.55`
- Full JSR specifiers: `jsr:@skmtc/gen-zod@^0.0.55`

The CLI normalizes all three forms.

## Output style

### Human mode (no `--json`)

- Colored output to stdout/stderr
- Progress indicators for long-running operations
- Tables for tabular data (e.g., `skmtc list`)

### JSON mode (`--json`)

- Single JSON object to stdout
- Errors go to stderr (also as JSON when `--json` is set)
- No progress indicators

## See also

- [skmtc-cli skill](../../skills/skmtc-cli/SKILL.md) — operational
  digest covering the common workflows
- [Reference: client.json schema](../settings/client-json-schema.md)
  — the per-project settings file
- [The three phases concept](../../concepts/the-three-phases.md) —
  what `generate` orchestrates
- [Clone vs install concept](../../concepts/clone-vs-install.md) —
  when to use `clone` vs `install` vs `create`
