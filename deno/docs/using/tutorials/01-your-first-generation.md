# Your first generation

> Generate Zod schemas from an OpenAPI document in about five minutes.

## What you'll build

A Skmtc project with `@skmtc/gen-zod` installed, and a few `.ts`
files generated from an OpenAPI spec. They hold runtime validation
schemas for every component schema in the input.

This is the one first run of Skmtc: install the CLI, then `init`,
`install` and `generate`. To have a coding agent do it in your own
project, paste the
[setup prompt](https://github.com/skmtc/skmtc#set-up-with-an-agent)
from the repo README. It runs the same commands.

## Prerequisites

- A sample OpenAPI v3 spec (URL or local `.json` / `.yaml` file)

If you don't have one handy, use the canonical Petstore spec:
`https://petstore3.swagger.io/api/v3/openapi.json`.

## Step 1: Install the CLI

On macOS and Linux:

```bash
curl -fsSL https://skmtc.dev/install | sh
```

On Windows, in PowerShell:

```powershell
irm https://skmtc.dev/install.ps1 | iex
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
and a `.settings/skmtc.config.json` pre-filled with your `basePath`.
An older project can have `client.json` in place of this file.
`client.json` is the old, deprecated name, and it still works. To
move to the new name, run `skmtc migrate config <project>`.

## Step 3: Install a generator

```bash
skmtc install @skmtc/gen-zod petstore
```

The generator is added to `.skmtc/petstore/deno.json#imports`. See
[install reference](../../reference/cli/install.md) for what the
command does in detail.

## Step 4: Run generate

Pass the project and the spec:

```bash
skmtc generate petstore https://petstore3.swagger.io/api/v3/openapi.json
```

The engine fetches the spec, runs `gen-zod` against each schema
component, and writes the artifacts to `src/generated/`.

For a local file, pass its path: `skmtc generate petstore ./openapi.json`.
If the remote fetch fails (offline, proxy), download the spec to a
file and pass that path.

## Step 5: Read the output

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

The generated files import each other through the `@/` alias:
`pet.generated.ts` imports `@/types/category.generated.ts`. Thus, in an
app, `basePath` is the folder that your bundler's `@` alias points to.
The [init reference](../../reference/cli/init.md) shows the
alignment for Vite and Next.js.

## Step 6: Pin the schema source

`generate` does not save the spec you passed. To make
`skmtc generate petstore` enough for the next run, add a top-level
`source` to `.skmtc/petstore/.settings/skmtc.config.json`, beside the
`basePath` that `init` wrote:

```jsonc
{
  "source": "https://petstore3.swagger.io/api/v3/openapi.json",
  "settings": {
    "basePath": "src/generated"
  }
}
```

For a local file, use a relative path: `"source": "./openapi.json"`
(resolved against the workspace root). Then run:

```bash
skmtc generate petstore
```

The output is the same. The next tutorials use this short form.

## What just happened

The CLI ran the engine, which executed the [three phases](../../concepts/the-three-phases.md):

1. **Parse:** the parser for the document's OpenAPI version (3.0,
   3.1 or 3.2) converted it to a typed object model.
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
  add per-operation overrides via `skmtc.config.json`
- [How to debug a failing generation](../how-to/debug-failing-generation.md) —
  if anything went wrong above
- [Stock generators reference](../../reference/stock-generators/) —
  the catalog of other generators you could add
