# How to compose with another generator

> Reference another generator's Projection from your generator's
> output — by name, not by source text.

## When to use this

Your generator's output needs to reference what another generator
produces. Common cases: a hook generator referencing a Zod schema,
a form generator referencing a mutation hook, a TypeScript
operation generator referencing a model.

## Prerequisites

- Both generators installed (the peer can be cloned, JSR-stock,
  or another local generator).
- Familiarity with [cross-generator coordination](../../concepts/cross-generator-coordination.md).

## Steps

### Import the peer Projection class

```ts
import { ZodProjection } from '@skmtc/gen-zod'
import { TsProjection } from '@skmtc/gen-typescript'
```

You import the **class** (with its static methods like
`toIdentifierName` and `toExportPath`), not its rendered output. The
class is what the engine uses as a cache key.

If the peer is a sibling clone in your project, import via the
project's local path:

```ts
import { ZodProjection } from '@local/gen-zod/src/ZodProjection.ts'
```

### Call `insertOperation` or `insertNormalizedModel` from the constructor

In your Projection's constructor, declare what you need:

```ts
// TanstackQueryBase = toTsOasOperationProjectionBase({...}) in your base.ts

class TanstackQuery extends TanstackQueryBase {
  constructor(args) {
    super(args)

    // Get the request-body Zod schema
    const requestBodySchema = this.operation.toRequestBody(({ schema }) => schema)
    if (requestBodySchema) {
      this.requestZod = this.insertNormalizedModel(ZodProjection, {
        schema: requestBodySchema,
        fallbackName: `${toEndpointName(this.operation)}Body`
      })
    }
  }
}
```

`this.insertNormalizedModel` is the canonical entry point for
"materialize this schema as a Zod definition" (or any peer
Projection). The engine returns an `Inserted` describing the
existing or newly-created definition.

For model-by-refName composition, use `insertModel`:

```ts
const userTs = this.insertModel(TsProjection, 'User')
```

Both `insertModel` and `insertNormalizedModel` exist as
projection-base methods (`this.x`) that wrap the underlying
`GenerateContext` methods (`this.context.x`). The projection-base
versions auto-fill `destinationPath` from `this.settings`.

### Use the returned `Inserted` to get the identifier name

```ts
const zodName = this.requestZod.toName()
// → e.g., "createUserBody"
```

`toName()` returns the name string the peer Projection's
`toIdentifierName` produced.

### Reference the name in your template

```ts
override toString(): string {
  return `
    export const useCreateUser = () => useMutation({
      mutationFn: (body) => fetch('/users', {
        method: 'POST',
        body: JSON.stringify(${this.requestZod.toName()}.parse(body))
      }).then(r => r.json())
    })
  `
}
```

The import lands automatically — `insertNormalizedModel` records
that your file depends on the peer's file.

## Verification

After regenerating, your file should:

1. Have an `import { ... } from '<peer-export-path>'` line at the
   top
2. Reference the imported name inline

Inspect:

```bash
cat src/generated/<your-output-path>.ts
```

The peer file should also exist with the expected identifier:

```bash
cat src/generated/<peer-export-path>.ts
```

Both generators contributed; the engine registered the peer's
definition once even if multiple consumers reference it.

## Why composition is by-name, not by-source-text

A naive composition might say "let me grab the peer's
`toString()` result and stitch it into my output." This breaks
two ways:

1. **Order-dependent.** If your `toString()` runs before the
   peer's, the peer's output doesn't exist yet.
2. **Duplicate registration.** Stitching the source means each
   consumer carries its own copy.

By-name composition sidesteps both. You declare the peer
contribution (via `insertNormalizedModel`), receive an
`Inserted`-handle to the peer's identifier, and reference the
identifier in your template. The engine handles the file
materialization and import injection.

See [how idempotency works](../../explanation/how-idempotency-works.md).

## Troubleshooting

- **`toName()` returns undefined** — The peer Projection wasn't
  created. Check the peer's `isSupported` filter — your call may
  have been gated out.
- **Import line not in output** — Confirm the
  `insertNormalizedModel` (or `insertModel`) call actually runs.
  It must be reachable from the Projection's constructor.
- **Compile error: "Cannot find module ..."** — Peer generator
  isn't installed in the project. Run `skmtc list <project>` to
  confirm.

## Two ways to call it

There are two related methods:

- **`this.insertNormalizedModel`** (on the projection base — wraps
  the context method, auto-fills `destinationPath`)
- **`this.context.insertNormalizedModel`** (on `GenerateContext`
  directly — caller supplies `destinationPath`)

Both are valid; prefer the projection-base wrapper in generator
code.

## Related

- [API: GenerateContext](../../reference/api/generate-context.md) —
  `insertModel` / `insertNormalizedModel` reference
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md)
- [Recipe: composing multi-generator stacks](../recipes/composing-multi-generator-stacks.md) —
  the broader walked example using `gen-shadcn-form` and
  `gen-shadcn-table`
- [How to swap a peer dependency](swap-a-peer-dependency.md) —
  the related "I want a different peer" task
- [How idempotency works](../../explanation/how-idempotency-works.md)
