# Your first generation

> Generate Zod schemas from an OpenAPI document in about five minutes.

## What you'll build

A SKMTC project with `@skmtc/gen-zod` installed and a few `.ts`
files generated from an OpenAPI spec — runtime validation schemas
matching every component schema in the input.

## Prerequisites

- Deno installed (`deno --version`)
- A sample OpenAPI v3 spec (URL or local `.json` / `.yaml` file)

If you don't have one handy, use the canonical Petstore spec:
`https://petstore3.swagger.io/api/v3/openapi.json`.

## Step 1: Install the CLI

```bash
deno install -A -g --unstable-worker-options -n skmtc jsr:@skmtc/cli/mod.ts
```

Verify: `skmtc --version`.

The `--unstable-worker-options` flag is required because `@skmtc/worker`
constructs each per-project Worker with `new Worker(..., { deno: {
permissions: {...} } })` — the Deno-specific `Worker.deno.permissions`
API. As of Deno 2.7, that API sits behind this flag. Without it, the
first `skmtc generate` exits at runtime with `Unstable API
'Worker.deno.permissions'. The --unstable-worker-options flag must be
provided.` The flag has to be passed at install time — `deno install`
bakes the flags into the `skmtc` binary at `~/.deno/bin/skmtc`. If you
already installed without it, reinstall with `-f` to overwrite the
binary.

## Step 2: Create a project

In an empty directory:

```bash
skmtc init petstore
```

This scaffolds `.skmtc/petstore/` with default `deno.json` and
`client.json` files.

## Step 3: Install a generator

```bash
skmtc install @skmtc/gen-zod petstore
```

The generator is added to `.skmtc/petstore/deno.json#imports`. See
[install reference](../../reference/cli/install.md) for what the
command does in detail.

## Step 4: Configure the schema source

Edit `.skmtc/petstore/.settings/client.json`:

```jsonc
{
  "source": "https://petstore3.swagger.io/api/v3/openapi.json",
  "settings": {
    "basePath": "src/generated"
  }
}
```

For a local file, use a relative path: `"source": "./openapi.json"`
(resolved against the workspace root).

## Step 5: Run generate

```bash
skmtc generate petstore
```

The engine fetches the spec, runs `gen-zod` against each schema
component, and writes the artifacts to `src/generated/`.

## Step 6: Read the output

```bash
ls src/generated/
cat src/generated/Pet.generated.ts
```

Each schema component (`Pet`, `Order`, `User`, etc.) is now a
`zod` schema you can import:

```ts
import { pet } from './src/generated/Pet.generated.ts'

const validated = pet.parse(someApiResponse)
```

## What just happened

The CLI ran the engine, which executed the [three phases](../../concepts/the-three-phases.md):

1. **Parse:** the OpenAPI document was normalized to OAS 3.0 and
   converted to typed `OasDocument`/`OasSchema` instances.
2. **Generate:** `gen-zod`'s entry function iterated every schema
   component and called `insertModel(ZodProjection, refName)` for
   each, populating the file map.
3. **Render:** the file map was serialized to `{ path: content }`
   artifacts and written to disk.

No Prettier ran — consumers format their own output. See
[design-philosophy](../../explanation/design-philosophy.md) for
why.

## Next steps

- [Tutorial 02: Multiple generators](02-multiple-generators.md) —
  add types and hooks alongside the validators
- [Tutorial 03: Customize with enrichments](03-customize-with-enrichments.md) —
  add per-operation overrides via `client.json`
- [How to debug a failing generation](../how-to/debug-failing-generation.md) —
  if anything went wrong above
- [Stock generators reference](../../reference/stock-generators/) —
  the catalog of other generators you could add
