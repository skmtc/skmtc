# skmtc list

> Show installed generators in a project, with their sources (JSR,
> clone, or local create).

`list` is the inspection counterpart to `install`/`clone`/`create`/
`remove`. It reads the project's `deno.json#imports` and reports
each generator with its source classification. Use it to verify that
an install or clone landed, or to inventory a project before
`remove`-ing entries.

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

Emit JSON output. Implies `--no-input`.

## Behavior

The CLI reads `<project>/deno.json#imports`, classifies each entry
by source, and reports the result. No filesystem mutation happens —
`list` is read-only.

### Output format

Each generator is reported with three fields:

- **`name`** — the import key (e.g., `@skmtc/gen-zod`,
  `@local/my-emit`)
- **`source`** — one of `'jsr'`, `'clone'`, or `'local'`
- **`version`** — the resolved version (for JSR) or the file path
  (for clones/local)

### Sources listed (JSR vs local)

The CLI distinguishes three source kinds based on the import
specifier shape:

| `deno.json#imports` value | Classified as | Meaning |
|---|---|---|
| `jsr:@skmtc/gen-zod@^0.0.55` | `jsr` | JSR-published, unmodified |
| `./gen-zod/mod.ts` (under `.skmtc/<project>/`) | `clone` or `local` | Local source |
| `npm:...` (rare) | `jsr` (treated similarly) | NPM-published |

Clones and local-creates both have local paths; the CLI doesn't
visibly distinguish them in `list` output. They differ in
provenance:

- **Clone** — source originally copied from a JSR package via
  `skmtc clone`. May still resemble its upstream.
- **Local** — source scaffolded from scratch via `skmtc create`. No
  upstream relationship.

For practical purposes (rebundle, remove), they behave identically.

## JSON output

```jsonc
{
  "command": "list",
  "projectName": "my-api",
  "generators": [
    {
      "name": "@skmtc/gen-zod",
      "source": "jsr",
      "version": "^0.0.55"
    },
    {
      "name": "@skmtc/gen-typescript",
      "source": "jsr",
      "version": "^0.0.42"
    },
    {
      "name": "@local/my-form",
      "source": "local",
      "path": "./my-form/mod.ts"
    }
  ],
  "counts": {
    "jsr": 2,
    "clone": 0,
    "local": 1,
    "total": 3
  }
}
```

### Field reference

- **`generators[].name`** — the import key as it appears in
  `deno.json#imports`.
- **`generators[].source`** — `'jsr'`, `'clone'`, or `'local'`.
- **`generators[].version`** — for JSR sources, the resolved version
  range (echoed from the import specifier). For local sources,
  omitted; see `path`.
- **`generators[].path`** — for local sources only, the relative
  path under the project root.
- **`counts`** — convenience summary by source.

## Human-readable output

Without `--json`, the CLI emits a table:

```
Project: my-api

Name                           Source   Version
@skmtc/gen-zod                 jsr      ^0.0.55
@skmtc/gen-typescript          jsr      ^0.0.42
@local/my-form                 local    ./my-form/mod.ts

Total: 3 generators (2 jsr, 0 clones, 1 local)
```

## Examples

### Quick inspection

```bash
skmtc list my-api
```

### Programmatic consumption

```bash
skmtc list my-api --json | jq '.generators[] | select(.source == "clone") | .name'
```

Lists only cloned generators by name.

### Verify after install

```bash
skmtc install @skmtc/gen-msw my-api --json
skmtc list my-api --json
```

The post-install `list` is the canonical "did it work" check.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — list emitted (may be empty) |
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
- [skmtc-cli skill](../../skills/skmtc-cli/SKILL.md) — workflow
  context
