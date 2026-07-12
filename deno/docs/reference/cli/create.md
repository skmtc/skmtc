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
skmtc create <project> <generator> <type>
```

All three arguments are required positionals. The command takes
no flags — it always runs interactively in the sense that there's
nothing to prompt for once the positionals are supplied.

## Arguments

### `<project>`

The target project name. Must already exist (use `skmtc init` to
create it). Required in strict mode.

### `<generator>`

The new generator's name. Conventionally matches the JSR-package
naming pattern: kebab-case, descriptive of what it produces. Examples:
`my-zod-schema`, `internal-fetch-wrapper`, `pdf-form-renderer`.

The name becomes the directory name (`.skmtc/<project>/<generator>/`)
and the import key in `deno.json`. The generator's published
identity (its JSR scope, if you later publish) is set in its own
`deno.json#name` field; the CLI doesn't constrain that.

### `<type>` (`operation` | `model`)

The Projection kind the generator produces:

- **`operation`** — registers one Projection per OAS operation. Use for
  generators that produce per-endpoint code (hooks, fetch wrappers,
  forms, mock handlers).
- **`model`** — registers one Projection per OAS schema component. Use
  for generators that produce per-type code (Zod schemas, TypeScript
  type aliases, Valibot schemas).

This determines which projection-base factory is wired into the
scaffold:

| `<type>` | Factory used | Constructor args |
|---|---|---|
| `operation` | `toOasOperationProjectionBase` | `{ context, operation, settings }` |
| `model` | `toModelProjectionBase` | `{ context, refName, settings }` |

For models the constructor receives `refName`, not a schema —
the schema is resolved internally inside the Projection
constructor via `context.resolveSchemaRefOnce(refName, BaseId)`.
(The scaffold itself wraps these canonical args with optional
`destinationPath` and `rootRef?` fields exposed to user code.)

The `type` choice is permanent — you'd manually rewrite the scaffold
to change it. Pick based on what your generator produces per input.

## Behavior

### Files scaffolded

The CLI writes a minimal generator package:

For `<type> = model` (example: generator name `my-zod-schema` →
`MainModule = MyZodSchema`):

```
.skmtc/<project>/<generator>/
├── deno.json                       # generator's package metadata
├── mod.ts                          # top-level entry stub
└── src/
    ├── mod.ts                      # the Entry function (toModelEntry)
    ├── base.ts                     # toModelProjectionBase({...}) — the Projection base
    └── <MainModule>Projection.ts   # the Projection class extending the base
```

For `<type> = operation` (example: `internal-fetch` →
`MainModule = InternalFetch`):

```
.skmtc/<project>/<generator>/
├── deno.json
├── mod.ts
└── src/
    ├── mod.ts                      # the Entry function (toOasOperationEntry)
    ├── base.ts                     # toOasOperationProjectionBase({...})
    └── <MainModule>.ts             # the Projection class
```

The exact filenames and class names are derived from the generator
name PascalCased (`my-zod-schema` → `MyZodSchema`). **Note the
asymmetry**: model scaffolds write `<MainModule>Projection.ts`
(with a `Projection` suffix); operation scaffolds write
`<MainModule>.ts` (no suffix). Neither scaffold creates
`enrichments.ts` — add it manually if your generator needs
enrichments.

### `deno.json` imports updated

The project's `.skmtc/<project>/deno.json#imports` gets a new entry
pointing at the local source. The import-key **scope** is derived
from the CLI's auth state, not hard-coded:

```jsonc
// Example: run by an authenticated user `dgrabov`
{
  "imports": {
    "@dgrabov/my-zod-schema": "./my-zod-schema/mod.ts"
  }
}
```

The scope falls back through `Project.addGenerator` in
`cli/lib/project.ts:340–349`:

1. **Explicit scope from the input.** If you ran
   `skmtc create my-api @myorg/my-zod-schema model`, the scope is
   `@myorg` (parsed by `parseModuleName`).
2. **`jsr-user` fallback.** No explicit scope → the literal
   `jsr-user/<name>` (no `@` prefix). (Earlier CLIs substituted the
   Supabase-auth username here when logged in; that auth system is
   removed, so the fallback is now deterministic — the hub PAT plays
   no part in `create`.)

`@local/` is never used by the implementation. For a meaningful
scope in shared scripts or CI, pass it explicitly when running
`create`.

### Post-create rebundle

After scaffolding, the CLI rebuilds the project's `bundle.js` so the
new generator is reachable by the next `generate` invocation. The
generator's scaffold produces a valid (but mostly-empty) Projection
from the start, so the bundle compiles cleanly.

## Examples

### Create a model generator

```bash
skmtc create my-api my-zod-schema model
```

Produces `.skmtc/my-api/my-zod-schema/` with a model-projection
scaffold.

### Create an operation generator

```bash
skmtc create my-api internal-fetch operation
```

Produces an operation-projection scaffold under
`.skmtc/my-api/internal-fetch/`.

### Create then immediately edit

```bash
skmtc create my-api my-renderer operation
# Edit src/MyRenderer.ts to define toString()
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
- [Anatomy of a generator](../../authoring/anatomy-of-a-generator.md) —
  the parts you just scaffolded
- [Clone vs install concept](../../concepts/clone-vs-install.md) —
  decision tree for which command to use
