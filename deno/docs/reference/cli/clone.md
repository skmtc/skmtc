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

Skip the `@skmtc/core` check (see "Core check" below). The project
keeps its core pin, so the next bundle can load two cores. Use only
for intentional cross-version testing.

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

### Core check

One bundle holds one `@skmtc/core`. The CLI downloads every
generator the command names and reads the core range of each one.
Then it plans one exact `@skmtc/core` pin that satisfies those ranges
and the ranges of the generators that stay, and writes it into
`<project>/deno.json`.

The old local copies of the generators the command names do not
count. So one command moves two or more clones to a new core together:

```bash
skmtc clone my-api -g @skmtc/gen-zod@0.4.6 -g @skmtc/gen-typescript@0.2.21
```

If no version satisfies every range, the CLI refuses with exit code
2 before it writes any file:

```
Error: @skmtc/core conflict

No one @skmtc/core version satisfies every generator in this project, and one project runs one core:
  @skmtc/gen-typescript needs @skmtc/core 0.28.0 (local copy in ./gen-typescript)
  @skmtc/gen-zod needs @skmtc/core 0.44.2
Install versions of these generators built on the same core minor, or remove one of them.

A local copy keeps the core it was cloned on: @skmtc/gen-typescript.
Name each local copy in the same clone command to move them to a new core together, or pass --force to skip this check.
```

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

### Imports rewritten to bare specifiers

JSR serves published source with each bare import rewritten to a
versioned specifier (`from 'jsr:@skmtc/core@0.29.0'`,
`from 'npm:ts-pattern@^5.8.0'`). The CLI rewrites those imports back
to bare specifiers, so versions come from `deno.json#imports`:

```ts fragment
// As JSR serves it
import { capitalize } from 'jsr:@skmtc/core@0.29.0'

// As cloned
import { capitalize } from '@skmtc/core'
```

Only import positions change — strings, comments and non-source
files are written as served. A specifier whose version is a value
of the package's `deno.json#imports` becomes that entry's key. A
package the imports don't name becomes its bare name, pinned in the
clone's `deno.json` with the version it replaced. An import whose
version disagrees with the pin, or with another import of the same
package, was written that way on purpose and stays versioned.

### The project decides shared versions

The clone's `deno.json` keeps the package's own pins, except for any
name the project's root `deno.json` already pins. Those are dropped,
so the root decides their version: the clone runs on the project's
`@skmtc/core`, and a peer generator the project already cloned
resolves to its local copy.

After you edit a pin in either `deno.json`, run `skmtc generate`
again. It rebuilds the bundle from the current pins on every run.

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

### Peer imports

The clone's peers resolve through its own `deno.json` (or the
project's, for names the project pins), so nothing else is written
to the project's root `deno.json`. A peer generator the cloned
generator imports is not installed as a generator of the project.

### Post-clone rebundle

The CLI builds the bundle after the clone, to check that the cloned
generator bundles and that the project still resolves one copy of
`@skmtc/core`. The result is reported in the JSON output:

```jsonc
{
  "bundle": {
    "type": "bundled",
    "projectName": "my-api",
    "bundlePath": ".skmtc/my-api/bundle.js"
  }
}
```

`generate` does not use this bundle: it rebuilds the bundle on every
run, so your edits to the cloned source apply on the next
`skmtc generate`.

## JSON output

```jsonc
{
  "projectName": "my-api",
  "cloned": [
    { "moduleName": "@skmtc/gen-typescript", "version": "0.0.55" },
    { "moduleName": "@skmtc/gen-zod", "version": "0.0.55" }
  ],
  "bundle": {
    "type": "bundled",
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

### Force-clone over a core conflict

```bash
skmtc clone my-api -g @skmtc/gen-zod --force
```

Skips the core check. The clone lands on disk, but the next bundle
can load two cores, and `skmtc bundle` refuses a lock that resolves
two. Useful for intentional cross-version testing.

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
3. Run `skmtc generate <project>`, or `skmtc dev <project>` to
   regenerate on every save

See [anatomy of a generator](../../authoring/anatomy-of-a-generator.md)
for what you are editing.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — at least one generator cloned and bundled |
| `1` | Registry unreachable, version not found, bundle failure |
| `2` | Required argument missing OR `@skmtc/core` conflict (without `--force`) |

## See also

- [`skmtc install`](install.md) — alternative for stock-defaults
- [`skmtc generate`](generate.md) — rebuilds the bundle and runs your edited source
- [`skmtc dev`](dev.md) — rebuild and regenerate on file changes
- [clone-vs-install concept](../../concepts/clone-vs-install.md)
- [Tutorial: cloning a generator](../../authoring/tutorials/01-cloning-a-generator.md) — the guided first edit
- [generators-as-packages concept](../../concepts/generators-as-packages.md)
