# skmtc list

> Show installed generators in a project — the import keys from
> `<project>/deno.json#imports`, nothing more.

`list` is the inspection counterpart to `install`/`clone`/`create`/
`remove`. It reads the project's `deno.json#imports` and reports the
import keys. Use it to verify that an install or clone landed, or to
inventory a project before `remove`-ing entries.

`list` does **not** classify generators by source (JSR vs clone vs
local). That information has to be derived from the import specifier
in `deno.json#imports` if you need it. For a structured view that
*does* split sources, see [`agent-context`](agent-context.md) —
specifically `.projects[].generators.{remote,local}`.

## Synopsis

```
skmtc list [project] [--json] [--no-input]
```

## Arguments

### `[project]`

The target project name. Required in strict mode.

When unset (and not in strict mode), the CLI infers the project from
the workspace if there's exactly one. Multi-project workspaces
prompt for selection.

## Options

### `--no-input`

Disable interactive prompts.

### `--json`

Print JSON output. Implies `--no-input`.

## Behavior

The CLI reads `<project>/deno.json#imports` and prints the import
keys as a flat list. No filesystem mutation happens — `list` is
read-only.

## JSON output

```jsonc
{
  "projectName": "my-api",
  "generators": [
    "@skmtc/gen-zod",
    "@skmtc/gen-typescript",
    "@dgrabov/my-form"
  ]
}
```

### Field reference

- **`projectName`** — echoed from the argument.
- **`generators`** — a flat string array of import keys (every key
  under `deno.json#imports`). The shape matches `ListHeadlessResult`
  in `cli/lib/list-headless.ts`:

  ```ts
  export type ListHeadlessResult = {
    projectName: string
    generators: string[]
  }
  ```

No envelope (no `command` field). No per-entry object (entries are
strings, not records). No `version`, `source`, `path`, or `counts`
fields — `list` does not compute them. If you need any of those,
read `<project>/deno.json#imports` directly and parse the import
specifier yourself.

## Human-readable output

Without `--json`, the CLI prints a labelled bulleted list:

```
Generators in my-api:
  - @skmtc/gen-zod
  - @skmtc/gen-typescript
  - @dgrabov/my-form
```

An empty project prints `  (none)` under the heading.

## Examples

### Quick inspection

```bash
skmtc list my-api
```

### Programmatic consumption

```bash
skmtc list my-api --json | jq -r '.generators[]'
```

Streams the import keys one per line — pipe into any consumer.

To filter by source, read `deno.json` directly:

```bash
jq -r '.imports | to_entries[]
       | select(.value | startswith("jsr:"))
       | .key' \
  .skmtc/my-api/deno.json
```

(The `jsr:` prefix marks JSR-published packages; everything else is
a relative path — either a clone or a local-create.)

### Verify after install

```bash
skmtc install @skmtc/gen-msw my-api --json
skmtc list my-api --json
```

The post-install `list` is the canonical "did it work" check.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — list printed (may be empty) |
| `1` | Project's `deno.json` unreadable or malformed |
| `2` | Required argument missing in strict mode |

A project with zero generators returns exit code `0` with an empty
`generators` array — that's a valid state, not an error.

## Common failure modes

### Project not found

```
Error: project 'my-api' not found
```

The directory `.skmtc/<project>/` doesn't exist. Run `skmtc init` or
check the spelling.

### Malformed `deno.json`

```
Error: parsing .skmtc/my-api/deno.json: <reason>
```

The project's `deno.json` is invalid JSON or doesn't have the
expected shape. Open it manually to inspect.

### Workspace has no projects

```
Error: workspace has no projects (looked under .skmtc/)
```

You're in a workspace without `init`ed projects, or you're not in a
SKMTC workspace at all. Check the current directory and the workspace
`deno.json`.

## See also

- [`skmtc install`](install.md) — adds JSR generators
- [`skmtc clone`](clone.md) — forks JSR generators to local source
- [`skmtc create`](create.md) — scaffolds new local generators
- [`skmtc remove`](remove.md) — removes a generator
- [`skmtc doctor`](doctor.md) — runs deeper validation on the
  generator set
- [`skmtc agent-context`](agent-context.md) — for structured
  source-classified output (`.projects[].generators.{remote,local}`)
- [CLI overview](overview.md) — workflow
  context
