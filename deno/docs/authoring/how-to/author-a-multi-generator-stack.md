# Author a multi-generator stack

> Write a generator whose output composes types, validators, and hooks
> from peer generators into one artifact — the pattern behind the
> stock UI generators.

## When to use this

Your generator's artifact needs peer output from more than one
generator (a form needs a type, a validator, and a mutation hook),
and [compose with another generator](compose-with-another-generator.md)
covers only the single-peer case.

## Prerequisites

- A generator package to work in ([create](../../reference/cli/create.md)
  or [clone](../tutorials/01-cloning-a-generator.md) one).
- The single-peer composition pattern from
  [compose with another generator](compose-with-another-generator.md).
- For a fully worked reading of this pattern in stock source, the
  [composing multi-generator stacks recipe](../recipes/composing-multi-generator-stacks.md).

## Steps

### 1. Declare peer dependencies

Pin your peers in `deno.json#imports`. Use **exact JSR versions**
for inter-`@skmtc/*` package dependencies inside the SKMTC
monorepo; consumer projects can use carets. Importable as named
exports: `import { TsProjection } from '@skmtc/gen-typescript'`.

### 2. Decide your projection base

Three options:

- `toTsOasOperationProjectionBase` — one artifact per
  `(path, method)`. The form and table both use this.
- `toTsModelProjectionBase` — one artifact per schema. Used by
  `gen-typescript`, `gen-zod`, etc.
- `toTsGqlOperationProjectionBase` — one artifact per root field.
  Used by GraphQL-side generators.

Your `base.ts` declares `id`, `toIdentifierName`,
`toIdentifierType`, `toExportPath`, `toEnrichmentSchema` and
exports the resulting base class.

### 3. Author the Projection class

The Projection class extends your base, takes
`{ context, operation, settings }` (or
`{ context, refName, settings, destinationPath, rootRef }` for
models), and in the constructor:

- Pulls peer artifacts via
  `this.insertNormalizedModel(PeerProjection, args)` or
  `this.insertOperation(PeerProjection, operation)`. Stash
  `.toName()` (or the full `Inserted`) on `this`.
- Constructs child Snippets and stashes them on `this`. Pass each
  child `destinationPath: this.settings.exportPath` so its
  imports register against your file.
- Registers consumer-side library imports via
  `this.register({ imports: { ... } })`.

The Projection's `toString()` interpolates the stashed names and
Snippets into a template literal. No side effects in
`toString()`.

### 4. Wire it up in `mod.ts`

```ts
export const myEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  isSupported,                  // pick which operations apply
  toEnrichmentSchema,           // accept user enrichments
  transform: ({ context, operation }) => {
    context.insertOperation({ projection: MyProjection, operation })
  }
})
export default myEntry
```

Note: `transform` is the entry point. It must call
`context.insertOperation({ projection: MyProjection, operation })`
to instantiate your Projection — without this, your class is
never constructed. See
[how-generators-produce-output.md](../../concepts/how-generators-produce-output.md#projections-are-pull-based).

### 5. Test with a real OAS schema

Drop the generator into a project, run `skmtc generate`, inspect
the output and `.settings/manifest.json`. Items showing
`'notSupported'` were filtered by `isSupported`; items showing
`'success'` ran without throwing (which does **not** guarantee
they produced output — verify the `files` map).

## Variations

- **Operation generator depending on multiple model generators.**
  Pull in each via `insertNormalizedModel(MyModelProjection,
  { schema, fallbackName })`. The pattern scales —
  `gen-shadcn-form` pulls in three TS types (request body, props,
  path params) plus a Zod validator.
- **Model generator depending on another model generator.**
  Possible (`gen-arktype` could depend on `gen-typescript` for
  base types). The Driver flow is identical — the cache key
  shapes are model-shaped on both sides.
- **GraphQL stack.** Replace `toOasOperationEntry` with
  `toGqlOperationEntry`, replace HTTP-flavored peers with the
  GraphQL counterpart. The coordination pattern is identical.

## Common questions

### How do I tell which generator a peer artifact came from?

Read the generator key on the cached `Definition`. The Driver
sets it via `toXxxGeneratorKey({ generatorId, operation/refName })`
on construction. Errors print it: a "Registered definition
mismatch" tells you both the cached and the proposed generators.

### What if a peer fails to apply (its `isSupported` returns false for my operation)?

Your `insertOperation` call still returns an `Inserted` — but
the peer's Projection wasn't constructed and isn't in the file
map. This typically surfaces later as "Cannot find module" or
"X is not exported" when the consumer compiles the generated
output. Defensive code on your side: check the operation against
the peer's `isSupported` before calling.

In practice, multi-generator stacks declare their peer
dependencies tightly enough that this doesn't fire — the form
generator's `isSupported` is more restrictive than the type
generator's, so anything the form accepts the type generator
accepts too. Be deliberate about the `isSupported` boundary if
you're authoring a new stack.

### Can the peer's output depend on my output?

Yes — the cache is order-independent. Whichever generator's
`transform` fires first will hit the cache miss and construct;
the other will hit the cache hit and reuse. The dispatcher
iterates generators in their order in the config map, but the
coordination doesn't depend on that order. See
[cross-generator-coordination.md](../../concepts/cross-generator-coordination.md).

### How tightly should I pin peer versions?

For generators *inside* the SKMTC monorepo (the stock catalogue),
use exact JSR versions — peer-pin discipline. For generators
*outside* (your own clones, your own packages), use whatever
matches your release cadence. The clone process runs a peer-pin
check; mismatches show as errors before any state mutation.

### When should I split into two generators vs put everything in one?

Split when:

- Two artifacts have different export paths
  (`./forms/X.tsx` and `./types/X.ts` are clearly different
  files, so the type Projection and the form Projection are
  clearly different things).
- One artifact is reusable across many consumer Projections (a
  TS type is reused by the form *and* the table; it deserves its
  own Projection so the cache works).
- The customization seams are independent (you might swap form
  libraries without swapping type libraries).

Keep in one when:

- The output is a single file containing tightly-coupled
  declarations (`MockRoute` + `MockRoutesList` in `gen-msw` —
  the list aggregates the routes, both belong to the same
  artifact).
- The dependency is acyclic and not reused (a one-off helper
  Snippet for path-param destructuring — a Snippet is enough; no
  need for a separate Projection).

## Related

- [Recipe: composing multi-generator stacks](../recipes/composing-multi-generator-stacks.md) —
  the annotated read-through of ShadcnForm and ShadcnTable
- [How-to: compose with another generator](compose-with-another-generator.md) —
  the single-peer case
- [Concept: cross-generator coordination](../../concepts/cross-generator-coordination.md)
