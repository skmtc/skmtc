# skmtc clone

> Copy a generator's source from JSR into a project for local
> editing.

The customization seam. After cloning, the generator's source is
the user's code — editable in any way TypeScript allows. The
project's `deno.json#imports` switches from a JSR specifier to a
local path; the next bundle picks up the local source.

## Synopsis

```
skmtc clone [project] [-g <generator-id>...] [--force] [--json] [--no-input]
```

## Arguments

### `[project]`

The target project name. Required in strict mode.

## Options

### `-g, --generator <id>`

A JSR generator specifier. Repeat the flag for multiple:

```bash
skmtc clone my-api -g @skmtc/gen-zod -g @skmtc/gen-typescript --json
```

Required in strict mode — at least one `-g` must be provided.

### `--force`

Bypass the pre-flight `@skmtc/core` peer-pin check. Use only for
intentional cross-version testing; the resulting clone is unlikely
to bundle cleanly.

### `--no-input`

Disable interactive prompts.

### `--json`

Write JSON output to stdout. Implies `--no-input`.

## Behavior

### Source fetched from JSR

The generator's source files are fetched from JSR at the version
satisfying the user's semver constraint (or JSR-latest if no
constraint). The same registry `install` reads from.

Source of truth is JSR. No GitHub mirror is consulted.

### Pre-flight peer-pin check

Before downloading anything, the CLI compares:

- The project's `@skmtc/core` pin in `<project>/deno.json`
- The CLI's own `@skmtc/core` version (which the published
  generator was built against)

If they don't match by major.minor, the CLI refuses with exit code
2 and a recipe error:

```
Error: @skmtc/core peer-pin mismatch

Project pins:  ^0.0.974
CLI requires:  ^0.3.7

Update the project's "@skmtc/core" pin to "jsr:@skmtc/core@^0.3.7"
before cloning, or re-run with --force to skip this check.
```

The gate runs **before** any state mutation — a refused clone
leaves the project untouched.

### Local copy written

For each cloned generator, the CLI writes:

```
.skmtc/<project>/<gen-name>/
├── deno.json
├── mod.ts
└── src/
    └── ...
```

The directory mirrors the JSR package's source tree.

### deno.json#imports updated

The project's `deno.json` import entry switches from a JSR specifier
to a local path:

```jsonc
// Before
{ "@skmtc/gen-zod": "jsr:@skmtc/gen-zod@^0.0.55" }

// After
{ "@skmtc/gen-zod": "./gen-zod/mod.ts" }
```

Subsequent `generate` and `bundle` operations resolve to the local
source instead of JSR.

### Cross-generator peer imports

If the cloned generator depends on other generators (e.g., a form
generator depends on a Tanstack Query generator), the CLI writes
those peer imports into the project's root `deno.json#imports`
too. Other transitive peers (`@skmtc/core`, `@std/path`,
`valibot`, `tiny-invariant`) are expected to already be present;
the CLI does not overwrite them.

If a transitive peer is missing, the next `bundle` surfaces a
clear "No matching export" error. Run `skmtc doctor --json` to
identify the missing pin.

### Post-clone rebundle

The CLI automatically rebundles after the clone. This refreshes
`bundle.js` so subsequent `generate` runs see the new local
source. The rebundle is reported in the JSON output:

```jsonc
{
  "bundle": {
    "kind": "bundled",
    "projectName": "my-api",
    "bundlePath": ".skmtc/my-api/bundle.js"
  }
}
```

Without this step, a subsequent `generate` would silently load the
stale bundle and skip the cloned generator's changes. The post-
clone rebundle costs ~300ms and closes a class of silent-failure
debugging traps.

## JSON output

```jsonc
{
  "projectName": "my-api",
  "cloned": [
    { "moduleName": "@skmtc/gen-typescript", "version": "0.0.55" },
    { "moduleName": "@skmtc/gen-zod", "version": "0.0.55" }
  ],
  "bundle": {
    "kind": "bundled",
    "projectName": "my-api",
    "bundlePath": ".skmtc/my-api/bundle.js"
  },
  "verifyWith": "ls .skmtc/my-api/"
}
```

### Field reference

- **`projectName`**: echoed from the argument.
- **`cloned`**: array of cloned generators, each with `moduleName`
  (the JSR package ID) and `version` (the resolved version).
- **`bundle`**: the post-clone rebundle result.
- **`verifyWith`**: a follow-up command to confirm the clone landed.

## Examples

### Single clone

```bash
skmtc clone my-api -g @skmtc/gen-zod --json
```

### Multiple in one invocation

```bash
skmtc clone my-api \
  -g @skmtc/gen-typescript \
  -g @skmtc/gen-zod \
  -g @skmtc/gen-shadcn-form \
  --json
```

### Interactive (TTY)

```bash
skmtc clone my-api
```

The CLI launches an Ink MultiSelect picker showing available
installed generators. Use space to toggle, enter to confirm.

### Force-clone with peer mismatch

```bash
skmtc clone my-api -g @skmtc/gen-zod --force
```

Bypasses the pre-flight check. The clone lands on disk but the next
bundle will likely fail with cryptic peer-version errors. Useful for
intentional cross-version testing.

## When to clone vs install

See [clone-vs-install concept](../../concepts/clone-vs-install.md).
Short answer:

- **Install** if stock defaults work and you only need enrichments
- **Clone** if you need different paths, identifiers, peer deps, or
  output shape — anything beyond the per-operation overrides
  enrichments expose

## After cloning

The cloned source is now your code. Common next steps:

1. Edit `<project>/<gen-name>/src/base.ts` to change paths or
   identifiers
2. Edit `<project>/<gen-name>/src/<MainProjection>.ts` to change
   output shape
3. Run `skmtc dev <project>` for the rebundle-and-regenerate loop

See [`skmtc-generator` skill](../../skills/skmtc-generator/SKILL.md)
for authoring guidance.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — at least one generator cloned and bundled |
| `1` | Registry unreachable, version not found, bundle failure |
| `2` | Required argument missing OR peer-pin mismatch (without `--force`) |

## See also

- [`skmtc install`](install.md) — alternative for stock-defaults
- [`skmtc bundle`](bundle.md) — rebuilds after editing cloned source
- [`skmtc dev`](dev.md) — auto-rebundle on file changes
- [clone-vs-install concept](../../concepts/clone-vs-install.md)
- [`skmtc-generator` skill](../../skills/skmtc-generator/SKILL.md) — authoring guidance
- [generators-as-packages concept](../../concepts/generators-as-packages.md)
