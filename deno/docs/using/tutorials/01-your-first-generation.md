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
curl -fsSL https://skm.tc/install | sh
```

The installer bootstraps Deno if it isn't already on your machine and
bakes in the required `--unstable-worker-options` flag.

Confirm it's ready:

```bash
skmtc --help
```

You should see the list of `skmtc` commands.

## Step 2: Create a project

In an empty directory, pass a project name and a `basePath` — the
directory generated files are written to, relative to here:

```bash
skmtc init petstore src/generated
```

This scaffolds `.skmtc/petstore/`: a `deno.json` for generator imports
and a `.settings/client.json` pre-filled with your `basePath`.

## Step 3: Install a generator

```bash
skmtc install @skmtc/gen-zod petstore
```

The generator is added to `.skmtc/petstore/deno.json#imports`. See
[install reference](../../reference/cli/install.md) for what the
command does in detail.

## Step 4: Configure the schema source

`init` already wrote `basePath` into
`.skmtc/petstore/.settings/client.json`. Add a top-level `source` so the
file reads:

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
ls src/generated/types/
cat src/generated/types/pet.generated.ts
```

Each schema component (`Pet`, `Order`, `User`, etc.) is now a
`zod` schema under `types/` (gen-zod's export path), one file per
schema, named after the decapitalized schema name. Import it:

```ts
import { pet } from './src/generated/types/pet.generated.ts'

const validated = pet.parse(someApiResponse)
```

## What just happened

The CLI ran the engine, which executed the [three phases](../../concepts/the-three-phases.md):

1. **Parse:** the OpenAPI document was normalized to OAS 3.0 and
   converted to a typed object model.
2. **Generate:** `gen-zod` produced one definition per schema
   component and wrote each into an in-memory file map. (How that
   map works — and why it lets generators share output — is
   [Definitions and files](../../concepts/definitions-and-files.md);
   you'll see it pay off in tutorial 02.)
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
