# skmtc create

> Scaffold a new **local** generator from scratch — distinct from
> `clone` (which forks an existing JSR generator) and `install`
> (which pulls a JSR package without source). `create` produces a
> fresh generator source tree that you author from a blank slate.

The `create` command is the **author-from-scratch** path. It writes
a minimal generator project under `.skmtc/<project>/<generator>/`
and wires it into the project's `deno.json#imports`. After scaffolding,
you edit `src/` to define your generator's behavior, then run
`skmtc bundle` (or it will be triggered automatically by subsequent
commands) to make it available to the engine.

## Synopsis

```
skmtc create <project> <generator> <type> [--json] [--no-input]
```

## Arguments

### `<project>`

The target project name. Must already exist (use `skmtc init` to
create it). Required in strict mode.

### `<generator>`

The new generator's name. Conventionally matches the JSR-package
naming pattern: kebab-case, descriptive of what it emits. Examples:
`my-zod-schema`, `internal-fetch-wrapper`, `pdf-form-emit`.

The name becomes the directory name (`.skmtc/<project>/<generator>/`)
and the import key in `deno.json`. The generator's published
identity (its JSR scope, if you later publish) is set in its own
`deno.json#name` field; the CLI doesn't constrain that.

### `<type>` (`operation` | `model`)

The Projection kind the generator emits:

- **`operation`** — emits one Projection per OAS operation. Use for
  generators that produce per-endpoint code (hooks, fetch wrappers,
  forms, mock handlers).
- **`model`** — emits one Projection per OAS schema component. Use
  for generators that produce per-type code (Zod schemas, TypeScript
  type aliases, Valibot schemas).

This determines which projection-base factory is wired into the
scaffold:

| `<type>` | Factory used | Constructor args |
|---|---|---|
| `operation` | `toOasOperationProjectionBase` | `{ context, operation, settings }` |
| `model` | `toModelProjectionBase` | `{ context, schema, settings }` |

The `type` choice is permanent — you'd manually rewrite the scaffold
to change it. Pick based on what your generator emits per input.

## Options

### `--no-input`

Disable interactive prompts. Strict mode for scripts and agents.

### `--json`

Emit JSON output. Implies `--no-input`.

## Behavior

### Files scaffolded

The CLI writes a minimal generator package:

```
.skmtc/<project>/<generator>/
├── deno.json                 # generator's package metadata
├── mod.ts                    # exports the Entry function
└── src/
    ├── base.ts               # the projection base (extends factory)
    ├── <Generator>.ts        # the Projection class (with toString)
    └── enrichments.ts        # the Valibot enrichment schema (often empty)
```

The exact filenames and class names are derived from the generator
name (PascalCased). The skeleton is intentionally minimal — enough
to compile and run, with `// TODO` markers at each authoring point.

### `deno.json` imports updated

The project's `.skmtc/<project>/deno.json#imports` gets a new entry
pointing at the local source:

```json
{
  "imports": {
    "@local/my-zod-schema": "./my-zod-schema/mod.ts"
  }
}
```

The `@local/` prefix is conventional but not required — the CLI uses
whatever import alias the user supplies (or defaults to `@local/`).

### Post-create rebundle

After scaffolding, the CLI rebuilds the project's `bundle.js` so the
new generator is reachable by the next `generate` invocation. The
generator's scaffold emits a valid (but mostly-empty) Projection
from the start, so the bundle compiles cleanly.

## JSON output

```jsonc
{
  "command": "create",
  "projectName": "my-api",
  "generator": "my-zod-schema",
  "type": "model",
  "path": ".skmtc/my-api/my-zod-schema",
  "filesCreated": [
    ".skmtc/my-api/my-zod-schema/deno.json",
    ".skmtc/my-api/my-zod-schema/mod.ts",
    ".skmtc/my-api/my-zod-schema/src/base.ts",
    ".skmtc/my-api/my-zod-schema/src/MyZodSchema.ts",
    ".skmtc/my-api/my-zod-schema/src/enrichments.ts"
  ],
  "bundle": {
    "kind": "bundled",
    "bundlePath": ".skmtc/my-api/bundle.js"
  },
  "verifyWith": "skmtc list my-api --json"
}
```

## Examples

### Create a model generator

```bash
skmtc create my-api my-zod-schema model
```

Produces `.skmtc/my-api/my-zod-schema/` with a model-projection
scaffold.

### Create an operation generator (scripted)

```bash
skmtc create my-api internal-fetch operation --json --no-input
```

Strict mode, JSON output. Suitable for CI or agent workflows.

### Create then immediately edit

```bash
skmtc create my-api my-emit operation
# Edit src/MyEmit.ts to define toString()
skmtc bundle my-api
skmtc generate my-api
```

The bundle step after editing isn't strictly required — `generate`
will pick up the bundled source — but running it explicitly produces
clearer errors if the generator has compile issues.

## `create` vs `clone` vs `install`

| Action | Source | When to use |
|--------|--------|------------|
| `create` | Scaffold from template | New generator, no existing JSR analog |
| `clone` | Fork existing JSR generator | Customize an existing generator's behavior |
| `install` | Add JSR-published generator | Use a published generator unchanged |

If you're modifying an existing generator's behavior, `clone` is
usually the better starting point — you inherit the published
generator's already-debugged logic and customize from there. `create`
is for the rarer case where you're writing something new entirely.

See [clone-vs-install concept](../../concepts/clone-vs-install.md)
for the full mental model.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — generator scaffolded and project rebundled |
| `1` | Operational failure (filesystem, name collision) |
| `2` | Required argument missing in strict mode |

## Common failure modes

### Generator name collides

```
Error: generator 'my-zod-schema' already exists in project 'my-api'
```

The directory `.skmtc/<project>/<generator>/` already exists.
Choose a different name or `skmtc remove` the existing one first.

### Project doesn't exist

```
Error: project 'my-api' not found
```

Run `skmtc init my-api` first.

### Bundle compile failure

If the scaffold somehow fails to compile (rare; usually a CLI bug),
the create step succeeds but the post-create rebundle fails. The
scaffold remains on disk; fix the compile error and re-run
`skmtc bundle`.

## See also

- [`skmtc clone`](clone.md) — for customizing existing JSR generators
- [`skmtc install`](install.md) — for adding JSR generators unchanged
- [`skmtc bundle`](bundle.md) — explicit rebundle (triggered after `create`)
- [`skmtc list`](list.md) — verify the generator was added
- [Projection bases reference](../api/projection-bases.md) — what
  the scaffolded base extends
- [skmtc-generator skill](../../skills/skmtc-generator/SKILL.md) —
  operational guide for authoring generators
- [Clone vs install concept](../../concepts/clone-vs-install.md) —
  decision tree for which command to use
