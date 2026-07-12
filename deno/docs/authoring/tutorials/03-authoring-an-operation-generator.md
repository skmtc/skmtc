# Authoring an operation generator

> Build a generator that produces one file per OpenAPI operation. We'll
> make a curl-command generator — concrete, useful, and exercises
> the patterns operation generators typically need.

## What you'll build

A generator (`curl-cmd`) that produces a `curl` shell command per
operation:

```ts
// src/generated/pets/getPetById.curl.ts
export const getPetByIdCurl = ({ petId }: { petId: number }) =>
  `curl -X GET 'https://api.example.com/pet/${petId}'`
```

A small but real generator that exercises `isSupported`,
parameter extraction, and Snippet decomposition.

## Prerequisites

- The model-generator tutorial under your belt ([tutorial 02](02-authoring-a-model-generator.md)).
- Familiarity with [the OAS document model](../../reference/api/oas-document-model.md).

## Step 1: Scaffold with `skmtc create`

```bash
skmtc create my-project curl-cmd operation
```

Note: `operation`, not `model`. The factory used internally is
`toOasOperationEntry`. See [`skmtc create` reference](../../reference/cli/create.md).

The scaffold writes three files in `src/`: `mod.ts` (the Entry),
`base.ts` (the `toTsOasOperationProjectionBase({...})` factory
call), and `CurlCmd.ts` (the Projection class). The class file
matches `<MainModule>.ts` — no `Projection` suffix on operation
scaffolds (model scaffolds add the suffix).

## Step 2: Implement `isSupported`

Operation generators decide upfront which operations they handle.
`isSupported` is the canonical place. For curl, every HTTP
operation is fair game. The flag lives on the Entry config in
`src/mod.ts`:

```ts
// src/mod.ts
isSupported({ operation }) {
  return true
}
```

If you wanted to limit to GET only:

```ts
isSupported({ operation }) {
  return operation.method === 'get'
}
```

Or to mutations with bodies:

```ts
isSupported({ operation }) {
  return (
    ['post', 'put', 'patch'].includes(operation.method) &&
    Boolean(operation.toRequestBody(({ schema }) => schema))
  )
}
```

`isSupported` returning false → operation is skipped silently.
The flag is also available as a static on the projection-base
class (`CurlCmdBase.isSupported`), so other generators can probe
it through the operation-reference protocol.

## Step 3: Implement `toIdentifierName`, `toIdentifierType`, and `toExportPath` in `base.ts`

`base.ts` calls `toTsOasOperationProjectionBase({...})` (the
TypeScript projection-base veneer from `@skmtc/lang-typescript`)
and exports the resulting class. The pure naming functions are
config fields on that call — not free-standing exports:

```ts
// src/base.ts
import { emptyEnrichmentSchema, toEndpointName } from '@skmtc/core'
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import type { TsIdentifierType } from '@skmtc/lang-typescript'
import { join } from '@std/path/join'

export const CurlCmdBase = toTsOasOperationProjectionBase({
  id: '@local/curl-cmd',

  toIdentifierName({ operation }): string {
    return `${toEndpointName(operation)}Curl`
  },

  toIdentifierType: (): TsIdentifierType => ({ type: 'variable' }),

  toExportPath({ operation }): string {
    const tag = operation.tags?.[0] ?? 'misc'
    return join('@', tag, `${toEndpointName(operation)}.curl.ts`)
  },

  toEnrichmentSchema: () => emptyEnrichmentSchema
})
```

`toEndpointName` is the canonical helper from `@skmtc/core` for
deriving a JS-safe name from `operationId` (with fallback to
path+method). `toEnrichmentSchema` is required; this generator takes
no user configuration, so it passes core's `emptyEnrichmentSchema` —
see [how to add enrichment options](../how-to/add-enrichment-options.md)
for a generator that declares its own.

## Step 4: Implement the Projection class

The class extends the factory-returned base (`CurlCmdBase`), not
the abstract `OasOperationProjectionBase` directly:

```ts
// src/CurlCmd.ts
import type { OasOperationProjectionConstructorArgs, OasParameter } from '@skmtc/core'
import { CurlCmdBase } from './base.ts'

export class CurlCmd extends CurlCmdBase {
  constructor(args: OasOperationProjectionConstructorArgs) {
    super(args)
  }

  override toString(): string {
    const method = this.operation.method.toUpperCase()
    const pathParams = this.operation.toParams(['path'])
    const queryParams = this.operation.toParams(['query'])

    const tsArgs = [...pathParams, ...queryParams]
      .map(p => `${p.name}: ${this.tsTypeFor(p)}`)
      .join(', ')

    const url = this.urlTemplate(pathParams, queryParams)

    return `({ ${tsArgs.length ? tsArgs.replace(/:.*?($|,)/g, '$1') : ''} }${tsArgs ? `: { ${tsArgs} }` : ''}) =>
  \`curl -X ${method} '${url}'\``
  }

  private tsTypeFor(p: OasParameter): string {
    const s = p.toSchema()?.resolve()
    if (!s || s.isRef()) return 'unknown'
    if (s.type === 'integer' || s.type === 'number') return 'number'
    if (s.type === 'boolean') return 'boolean'
    return 'string'
  }

  private urlTemplate(pathParams: OasParameter[], queryParams: OasParameter[]): string {
    let url = `https://api.example.com${this.operation.path}`
    for (const p of pathParams) url = url.replace(`{${p.name}}`, `\${${p.name}}`)
    if (queryParams.length) {
      const qs = queryParams.map(p => `${p.name}=\${${p.name}}`).join('&')
      url += `?${qs}`
    }
    return url
  }
}
```

The full implementation is more delicate than the snippet above —
real generators handle headers, request body, encoding edge
cases. The point is the shape: read from `this.operation`,
produce a string.

## Step 5: Decompose into Snippets

Once `toString()` gets long, extract pieces into Snippet classes.
A Snippet is a `SnippetBase` subclass with its own `toString()`
that gets interpolated:

```ts fragment
// src/UrlTemplate.ts
import { SnippetBase, type OasParameter } from '@skmtc/core'

export class UrlTemplate extends SnippetBase {
  constructor(private operation: OasOperation, args: ConstructorArgs) {
    super(args)
  }

  override toString(): string {
    // ... the url-templating logic from above
  }
}
```

Then in CurlCmd's `toString()`:

```ts
const url = new UrlTemplate(this.operation, { context: this.context })
return `(args) => \`curl -X ${method} '${url}'\``
```

Template-literal interpolation calls `url.toString()`
implicitly. See [projections-and-snippets concept](../../concepts/projections-and-snippets.md).

## Step 6: Wire enrichments

The scaffold does not create `src/enrichments.ts`. Add it
yourself when you need user-configurable behavior. The schema is
the **three-scope umbrella** — `v.object({ subject, generator, stack })`.
Your per-operation options go under `subject`; leave the run-constant
scopes `v.undefined()` when unused:

```ts
// src/enrichments.ts
import * as v from 'valibot'

// The per-operation leaf.
export const curlSubject = v.optional(
  v.object({
    baseUrl: v.optional(v.string())
  })
)

export const enrichmentSchema = v.object({
  subject: curlSubject,
  generator: v.undefined(),
  stack: v.undefined()
})

export type EnrichmentSchema = v.InferOutput<typeof enrichmentSchema>
export const toEnrichmentSchema = () => enrichmentSchema
```

Wire it through the entry config and projection-base config (both
take the required `toEnrichmentSchema` field), then read the `subject`
scope in the Projection:

```ts
const baseUrl = this.settings.enrichments.subject?.baseUrl ?? 'https://api.example.com'
```

Users set `baseUrl` per operation in `client.json` under the OAS
operation routing path `enrichments[generatorId][path][method][variant]`
— the subject leaf sits under the variant key (`main` by default):

```jsonc
{
  "enrichments": {
    "@local/curl-cmd": {
      "/users": {
        "get": {
          "main": { "baseUrl": "https://staging.example.com" }
        }
      }
    }
  }
}
```

## Step 7: Iterate with `skmtc dev`

```bash
skmtc dev my-project
```

Edit, save, watch output update. Verify with `cat src/generated/pets/getPetById.curl.ts`.
Leave `dev` running whenever you're editing a generator — the
edit-save-read loop is the normal way to work.

## What just happened

Operation generators add three concerns model generators don't
have:

1. **`isSupported`** — declare your scope upfront, filter
   operations that don't fit.
2. **Parameter handling** — `operation.toParams()`,
   `operation.toRequestBody()`, etc. give you the operation's
   inputs.
3. **Snippet decomposition** — keep `toString()` readable by
   pushing sub-parts into Snippet classes.

The model-generator pattern from [tutorial 02](02-authoring-a-model-generator.md)
still applies underneath — `toIdentifierName`, `toIdentifierType`,
and `toExportPath` are still pure, the cache key is still
`(name, exportPath)`, the register/insertion APIs are the same.

## Next steps

- [How to compose with another generator](../how-to/compose-with-another-generator.md) —
  reference other generators (e.g., import a Zod schema for
  validation in your curl command)
- [How to add enrichment options](../how-to/add-enrichment-options.md) —
  more on the enrichments side
- [How to handle GraphQL instead of OAS](../how-to/handle-graphql-instead-of-oas.md) —
  the GraphQL equivalent of this tutorial
- [API: OAS document model](../../reference/api/oas-document-model.md) —
  the parsed types you're reading from
- [skmtc-generator skill](../../skills/skmtc-generator/SKILL.md) —
  ongoing operational guide
