# Cloning a generator

> Clone a stock generator into your project, make a visible
> change, and regenerate. The on-ramp for everything else in
> `extending/`.

## What you'll build

A cloned copy of `@skmtc/gen-zod` at `.skmtc/<project>/gen-zod/`,
with one edit (the export path), regenerated and verified.

By the end you'll have seen the clone source layout, the
rebundle step, and the iteration loop.

## Prerequisites

- A SKMTC project (use the one from [`using/`'s tutorial 01](../../using/tutorials/01-your-first-generation.md)
  if you haven't built one yet).
- Deno + `skmtc` CLI installed.

## Step 1: Clone the generator

```bash
skmtc clone my-project -g @skmtc/gen-zod
```

The `-g/--generator` flag accepts a JSR specifier. It's
**repeatable** — pass `-g` multiple times to clone several
generators in one invocation.

The CLI copies the published source into
`.skmtc/my-project/gen-zod/` and updates `.skmtc/my-project/deno.json#imports`
to point at the local path instead of the JSR specifier. See
[`skmtc clone` reference](../../reference/cli/clone.md) for the
command surface.

Verify:

```bash
skmtc list my-project --json | jq '.generators[] | select(.name | contains("zod"))'
# → { "name": "...", "source": "clone", "path": "./gen-zod/..." }
```

## Step 2: Inspect the source layout

```bash
ls .skmtc/my-project/gen-zod/src/
```

Typical model-generator layout:

```
.skmtc/my-project/gen-zod/
├── deno.json                   # generator's own package metadata
├── mod.ts                      # exports the Entry (`zodEntry`)
└── src/
    ├── mod.ts                  # the Entry function
    ├── base.ts                 # toIdentifier + toExportPath
    ├── ZodProjection.ts        # the main Projection class
    ├── Zod*.ts                 # per-OasSchema-variant classes
    ├── enrichments.ts          # Valibot schema (often empty for gen-zod)
    └── ...
```

The whole generator is **a few hundred lines**. Read it. It's
short enough that you can hold the structure in your head.

## Step 3: Make a small edit (export path)

Open `src/base.ts`. Find `toExportPath` — it'll look something
like:

```ts
toExportPath({ schema, refName }): string {
  return `/models/${refName}.generated.ts`
}
```

Change the path:

```ts
toExportPath({ schema, refName }): string {
  return `/schemas/${refName}.ts`
}
```

This is the **canonical first edit** because the file moves on
disk. You'll see the change at `ls` time, before opening
anything.

## Step 4: Rebundle

```bash
skmtc bundle my-project
```

Cloned generators are bundled into a single `bundle.js` that the
Worker loads. Source edits aren't visible until you rebundle.
`skmtc doctor` flags stale bundles if you forget.

## Step 5: Regenerate and verify

```bash
skmtc generate my-project
```

Output now lands in `src/schemas/` instead of `src/models/`.
Confirm:

```bash
ls src/schemas/
# Pet.ts  User.ts  Order.ts  ...
```

The contents are unchanged — only the path changed. If you'd
edited `ZodProjection.ts` instead, the contents would change.

## What just happened

`skmtc clone` is a fork operation. It copies upstream source to
your project, switches the import in `deno.json` to a local
path, and rebundles. From that point on, the local source is
authoritative — JSR updates don't reach you unless you re-clone
or manually merge.

The `(identifier.name, exportPath)` cache key for definitions
incorporates `exportPath` directly, so changing `toExportPath`
moves every emitted definition to the new location. Other
generators referencing the same schemas pick up the new path
automatically via cross-generator coordination.

## Next steps

- [How to change export paths](../how-to/change-export-paths.md) —
  the targeted reference for this kind of edit
- [Tutorial 02: Authoring a model generator from scratch](02-authoring-a-model-generator.md) —
  building one without a starting template
- [Stock generators catalog](../../reference/stock-generators/) —
  see what other generators look like; they all share the same
  source layout
- [skmtc-generator skill](../../skills/skmtc-generator/SKILL.md) —
  operational guide for ongoing extending work
