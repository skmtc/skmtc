# How to install a generator

> Add a stock JSR-hosted generator to an existing SKMTC project.

## When to use this

You want a stock generator's output as-is. If you'll need to
modify the generator's behavior, see [tutorial: cloning a
generator](../../extending/tutorials/01-cloning-a-generator.md)
instead.

## Prerequisites

- A SKMTC project (run `skmtc init <project>` first if needed).
- The generator's package name (e.g., `@skmtc/gen-zod`). See the
  [stock generators catalog](../../reference/stock-generators/overview.md).

## Steps

### Find the generator on JSR

Stock generators live at `@skmtc/gen-*`. Browse the catalog or
search JSR directly. Each generator's reference doc lists what it
produces and what it composes with.

### Run `skmtc install`

```bash
skmtc install @skmtc/gen-zod my-project
```

Optional: pin a version explicitly.

```bash
skmtc install @skmtc/gen-zod@^0.0.55 my-project
```

The CLI adds the import to `.skmtc/<project>/deno.json#imports`
and updates the Deno lockfile. See [install reference](../../reference/cli/install.md)
for the full command surface.

### Verify the install

```bash
skmtc list my-project --json
```

The new generator should appear with `source: "jsr"` and a
resolved version. Re-running `skmtc generate` will pick it up.

## Verification

After install, generate once and inspect a representative output
file. If the generator emits per-schema files (`gen-zod`,
`gen-typescript`), look for `src/generated/<Schema>.generated.ts`.
If it emits per-operation files (`gen-msw`, `gen-tanstack-*`),
look for `src/generated/<Tag>/<operation>.generated.ts`.

## Troubleshooting

- **"Generator not found on JSR"** — Check the package name; the
  CLI normalizes `@skmtc/gen-zod`, `jsr:@skmtc/gen-zod`, and
  `@skmtc/gen-zod@^0.0.55` to the same install. Typos surface as
  this error.
- **No output for the new generator** — Run `skmtc generate
  my-project --json | jq '.diagnostics'`. The generator may have
  `isSupported` filters that skip your operations (e.g.,
  `gen-shadcn-form` only handles POST/PUT/PATCH with object
  bodies).
- **Stale bundle warning** — If the project has cloned
  generators, run `skmtc bundle my-project` after install. `skmtc
  doctor` flags this.

## Related

- [`skmtc install` reference](../../reference/cli/install.md)
- [Stock generators catalog](../../reference/stock-generators/overview.md)
- [Clone vs install concept](../../concepts/clone-vs-install.md)
- [How to skip or include operations](skip-or-include-operations.md)
