# skmtc install

> Add JSR-hosted generators to a SKMTC project.

Adds JSR import entries to the project's `deno.json#imports` and
writes default settings to `client.json`. Transitive peer
dependencies resolve automatically.

## Synopsis

```
skmtc install [generators...] [project] [--json] [--no-input]
```

## Arguments

### `[generators...]`

One or more JSR generator specifiers. Required in strict mode.

Generator specifiers can be:

- Bare package names (latest version):
  `@skmtc/gen-zod`
- With explicit semver:
  `@skmtc/gen-zod@^0.0.55`
- Full JSR specifiers:
  `jsr:@skmtc/gen-zod@^0.0.55`

The CLI normalizes all three forms.

### `[project]`

The target project name. Required in strict mode.

## Options

### `--no-input`

Disable interactive prompts.

### `--json`

Write JSON output to stdout. Implies `--no-input`.

## Behavior

### `deno.json#imports` updated

For each generator argument, the CLI:

1. Resolves the latest version satisfying the user's semver
   constraint (or JSR-latest if no constraint given)
2. Adds the import entry to `<project>/deno.json#imports`:
   ```json
   "@skmtc/gen-zod": "jsr:@skmtc/gen-zod@^0.0.55"
   ```
3. Updates the Deno lockfile to pin the exact resolved version

### `client.json` is not modified

Install does **not** modify `client.json`. The generator's
`install({ denoJson })` method
(`cli/lib/generator.ts:96–98`) is a single call —
`denoJson.addImport(moduleName, fullName)` — and touches the
project's `deno.json` only. Enrichments are user-added on demand:
read the generator's `src/enrichments.ts` Valibot schema to learn
the shape, then type the keys into
`client.json#settings.enrichments` yourself. See
[How to configure enrichments](../../using/how-to/configure-enrichments.md).

### Post-install rebundle

If the project has at least one *cloned* (local) generator, the
CLI automatically rebundles after the install. This ensures the
local `bundle.js` picks up the new generator without a separate
`skmtc bundle` step.

If the project is remote-only (no clones), the rebundle is skipped
— there's no local bundle to update. The JSR-published bundle is
used at generate time.

### Verification

After write, the CLI reads back `deno.json` to confirm the import
actually landed. Closes a historical failure mode where install
silently no-op'd; now if the write fails, the CLI surfaces an
error.

## JSON output

### Remote-only project (no clones)

```jsonc
{
  "projectName": "my-api",
  "installed": ["@skmtc/gen-zod"],
  "bundle": {
    "kind": "noop",
    "reason": "remote-only",
    "detail": "Project has only remote (installed) generators; the published JSR `bundle.js` will be used by `skmtc generate`."
  },
  "verifyWith": "cat .skmtc/my-api/deno.json"
}
```

### Hybrid project (has at least one clone)

```jsonc
{
  "projectName": "my-api",
  "installed": ["@skmtc/gen-zod"],
  "bundle": {
    "kind": "bundled",
    "projectName": "my-api",
    "bundlePath": ".skmtc/my-api/bundle.js"
  },
  "verifyWith": "cat .skmtc/my-api/deno.json"
}
```

### Field reference

- **`projectName`**: echoed from the argument.
- **`installed`**: array of generator IDs added in this invocation.
- **`bundle.kind`**: `"noop"` (remote-only) or `"bundled"` (rebuild ran).
  The CLI writes an explicit no-op rather than silently doing nothing
  — eliminates the "did it work?" ambiguity.
- **`verifyWith`**: a follow-up command the agent can run to confirm
  the install landed.

## Examples

### Basic install

```bash
skmtc install @skmtc/gen-zod my-api
```

### Multiple at once

```bash
skmtc install @skmtc/gen-zod @skmtc/gen-typescript @skmtc/gen-msw my-api --json
```

### With version constraint

```bash
skmtc install @skmtc/gen-zod@^0.0.55 my-api --json
```

## Peer dependencies

Generators have peer dependencies (`@skmtc/core`, `@skmtc/worker`,
`@std/path`, sometimes `valibot`, `tiny-invariant`, etc.). These
should already be in the project's `deno.json` from `init` (or from
earlier `install` runs).

The CLI does **not** add transitive peer deps automatically — it
relies on them already being present. If a peer is missing, the
next `bundle` or `generate` will surface a clear error.

The `skmtc doctor` `project-core-pin/<project>` check verifies the
project's `@skmtc/core` pin matches the CLI's. Run after `install`
if you suspect peer-dep drift.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — at least one generator installed |
| `1` | Registry unreachable, version not found, write failure |
| `2` | Required argument missing |

## Common failure modes

### Generator not found on JSR

```
Error: jsr:@skmtc/gen-xyz not found in registry
```

The package name is wrong or the registry is unreachable. Check the
spelling; verify the JSR_URL if using a private registry.

### Version not found

```
Error: jsr:@skmtc/gen-zod@^99.0.0 not found
```

The semver constraint doesn't match any published version. Remove
the constraint to get JSR-latest, or specify a version that exists.

### Write failure

The CLI silently no-op'd in older versions. With the read-back
verification, write failures now surface explicitly. Rare in
practice; usually filesystem-permission related.

## See also

- [`skmtc init`](init.md) — typically preceded by init
- [`skmtc clone`](clone.md) — for source-level customization
- [`skmtc remove`](remove.md) — undoes an install
- [`skmtc doctor`](doctor.md) — verifies peer-dep alignment
- [clone-vs-install concept](../../concepts/clone-vs-install.md) — when to install vs clone
