# Variants

A **variant** is a named axis below `(operation, method)` (OAS),
`(rootKind, fieldName)` (GraphQL), or `refName` (models) along which
a single source item can produce *N* Definitions instead of one.
Variants are how SKMTC handles the case where the consumer's UI or
runtime naturally produces multiple artifacts from a single endpoint
or schema — most often **section-edit forms** for a broad `PATCH`
endpoint, **wizard-step flows** for multi-step `POST`s, **mock-
scenario flavours** (`success` / `error` / `slow`) for a single
mocked route, or **coercive vs strict** zod schemas for the same
component model.

## TL;DR

- Variants live one level deeper than the pre-variants enrichment
  leaf:
  - OAS:    `enrichments[generatorId][path][method][variantName]`
  - GQL:    `enrichments[generatorId][rootKind][fieldName][variantName]`
  - Model:  `enrichments[generatorId][refName][variantName]`
- `'main'` is always present. If the consumer writes any variants at
  all without `'main'`, the engine throws at start.
- A generator becomes **variants-aware** when its `toIdentifierName`
  reads `variant` and folds it into the returned name (typically via
  `withVariant(base, variant)`). Variants-unaware generators destructure
  the arg and ignore it.
- Cross-generator `insertOperation` / `insertModel` defaults to
  `'main'`. Pass an explicit non-`'main'` variant only when you know
  the peer declares it; the Driver throws otherwise.
- Variants are local to the variants-aware generator. The form
  generator can have `customer` / `location` variants without
  `gen-zod`, `gen-typescript`, or `gen-tanstack-query` knowing
  variants exist. The zod-variants generator can have `coercive`
  variants without operation generators threading them — operation
  callers stay on `'main'` unless they opt in.

## What problem the variant axis solves

A single OpenAPI operation can map to several distinct UI artifacts.
A broad `PATCH /v2/quoting/quotes/{quoteId}` body with 11 fields is
naturally split, in a FieldPlan-style UI, across 5+ section-edit pages
— each editing 1–2 fields against the same endpoint. Pre-variants,
SKMTC assumed a 1:1 between operation and Definition: one form per
`(operation, method)`. Producing N forms from one endpoint required
hand-coding the extras.

The same 1:1 problem exists for models: a `Customer` component schema
might naturally produce *both* a strict zod schema (for JSON bodies)
*and* a coercive variant (`z.coerce.*` for query-param parsing). One
schema, two emitted modules.

The 1:1 leaked across three layers — the enrichment shape, the
`toIdentifierName` / `toExportPath` cache key, and the engine's
per-item dispatch — and meant everything past the first artifact
stayed hand-coded.

The variant axis lifts that 1:1 to 1:N. One operation (or one
refName), N Definitions, each labelled by a string variant name.
The variant flows through:

- **Enrichment routing** — variant names are the keys one level
  deeper than the pre-variants leaf (both operation and model arms).
- **The engine's per-item dispatch** — `#runOasOperationGenerator`,
  `#runGqlOperationGenerator`, and `#runModelGenerator` each contain
  a nested `reduce` over the variants declared for that item.
- **`ContentSettings.variant`** — every Projection's settings bag
  carries the variant it was constructed for.
- **`toIdentifierName`, `toExportPath`, `toEnrichments`,
  `transform`, `isSupported`, `toPreviewModule`, `toMappingModule`**
  — every callback that runs per `(item, variant)` receives the
  variant string. Models' `transform`/`toPreviewModule`/
  `toMappingModule` receive it too.
- **`GeneratorKey`** — operations went from 3 to 4 segments and
  models went from 2 to 3 segments, with `variant` appended in both
  cases (`id|path|method|variant`, `id|rootKind|fieldName|variant`,
  `id|refName|variant`).
- **`StackTrail`** — each variant gets its own frame nested inside
  the item frame (`<root>:<gen-id>:<path>:<method>:variant: <name>`
  for operations; `<root>:<gen-id>:<refName>:variant: <name>` for
  models).
- **Manifest source** — `OasOperationSource`, `GqlOperationSource`,
  and `ModelSource` all carry the variant; one manifest entry per
  `(item, variant)`.

## The six invariants

These hold the design together. If implementation hits a snag and
decisions need re-making, preserve these.

### 1. Variants are an enrichment-level routing axis

They aren't a separate config block, a magic field on operations, or
a side-channel. The level one step deeper than today's leaf IS the
variant. The engine reads variants by `Object.keys` on that level.
No introspection, no `typeof` check, no shape guessing.

### 2. `'main'` is always present

Every operation that any generator processes has a `'main'` variant.
If the consumer didn't write enrichments at all for a `(generator,
operation)`, the engine dispatches a single pass with `variant:
'main'` and an empty umbrella (`enrichments.subject` is `undefined`). If the consumer wrote any
variant keys, `'main'` MUST be among them — the engine throws at
start with `"must include a 'main' variant"` otherwise.

The throw is intentional. Allowing missing `'main'` would force the
engine to introspect every enrichment block to decide whether to
inject one synthetically, and would force cross-gen
`insertOperation` to fall back silently when the requested variant
didn't exist on the peer. The always-present invariant turns both
into impossible-by-construction properties.

### 3. The cache key stays narrow

`(name, exportPath)` remains the `findDefinition` cache key. Variant
is added to `GeneratorKey` (the trailing segment), not to the cache
key.

This is deliberate. A variants-aware generator that forgets to fold
`variant` into `toIdentifierName` produces TWO Definitions with the same
`(name, exportPath)` cache key — the second variant's `findDefinition`
hits the cached entry from the first variant, and the Driver's
`affirmDefinition` integrity check compares `generatorKey`s, sees the
trailing `|main` vs. `|customer` mismatch, and throws
`"Registered definition mismatch"`. Loud, consumer-visible failure
beats a silently doubled `export const Foo` ending up in one file.
This applies symmetrically to operation Drivers (4-segment keys) and
the model Driver (3-segment keys with the variant in slot 3).

### 4. Variants are local to the variants-aware generator

Adopting variants in one generator does not require the ecosystem to
be variants-aware. Peers default to `'main'` regardless of the
caller's variant. The form generator can have `description` /
`validity` variants without `gen-zod`, `gen-typescript`, or
`gen-tanstack-query` knowing variants exist — each peer is invoked
with `'main'`, its single Definition is shared across all variants
of the caller, and each variant's file gets an import to that shared
Definition.

### 5. Variant mismatches throw

When a caller explicitly passes `variant` to `insertOperation` or
`insertModel` and the peer doesn't have that variant in its
enrichments, the Driver throws (`assertPeerVariantExists`) with a
clear message including the available variants. Same for missing-
`main` at engine start. Loud failures replace silent wrong-output.

### 6. Variant names are kebab-case, case-sensitive at runtime

The Valibot regex `variantNameRegex` enforces lowercase
ASCII letters + digits joined by single hyphens at parse time:
`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`. The uppercase ban is what defuses
the only realistic collision: `withVariant('Form', 'line-items')`
produces `'FormLineItems'`; allowing both `lineItems` and `line-items`
would let both round-trip to the same PascalCase suffix.

## Lifecycle: how a variant flows through the engine

For an operation with enrichment `{ main: {…}, customer: {…} }`
under `gen-shadcn-form`:

1. **Engine** (`GenerateContext.#runOasOperationGenerator`) reads
   `enrichments[id][path][method]`, computes the variant list via
   `toVariantList` (`['main', 'customer']`), and runs an inner
   `forEach` over them.
2. For each variant, the engine pushes a `variant: <name>` frame to
   the `StackTrail`, then invokes the generator's `transform({
   context, operation, variant })`.
3. `transform` typically calls `context.insertOperation({ projection:
   ShadcnForm, operation, variant })`. The variant flows into the
   Driver.
4. **Driver** (`OasOperationDriver`) stores `variant` on the
   instance, asserts the peer declares it (always succeeds when
   `variant === 'main'`; otherwise checks the peer's enrichment
   block), and calls `context.toOperationContentSettings({operation,
   projection, variant})`.
5. **Context** calls the projection's static `toEnrichments`,
   `toIdentifierName` (plus `toIdentifierType` for the non-name
   identifier parts), and `toExportPath` with the variant, builds a
   `ContentSettings` carrying it, and returns it to the Driver.
6. **Projection constructor** runs with `args.settings.variant`
   already populated. Internal sibling Projections derive their
   `fallbackName` from `settings.identifier.name` — automatically
   variant-bound via `withVariant`.
7. **Definition registration** stamps `generatorKey` from
   `toOasOperationGeneratorKey({generatorId, operation, variant})`,
   a 4-segment string with the variant as the trailing segment.

The model arm is structurally identical with two substitutions:
`#runModelGenerator` reads `enrichments[id][refName][variant]`,
`context.toModelContentSettings({refName, projection, variant})`
builds the settings, and the registered `generatorKey` is
`toModelGeneratorKey({generatorId, refName, variant})` — a 3-segment
string ending in the variant.

## When NOT to use variants

Cross-cutting per-operation overrides are NOT variants:

- A global `title` override for one form → that's an enrichment
  field on the form's per-variant inner schema, not a separate
  variant.
- A theme override (`darkMode: true`) for one form → enrichment field.
- A language override for one operation → enrichment field.

Variants partition output into distinct Definitions. Enrichments
parameterise a single Definition's content. The test: would the
consumer want N distinct generated files (variants) or one
parameterised file (enrichment)?

## Cross-generator behaviour

The most common pattern: a variants-aware form composes with several
variants-unaware peers (`TanstackQuery`, `TsProjection`,
`ZodProjection`).

```ts
class FormProjection extends FormBase {
  constructor(args) {
    super(args)

    // Default 'main' — both 'main' and 'customer' variants of this
    // form land on the same TanstackQuery Definition (cache hit on
    // the second call). The peer's import is registered to each
    // variant's file independently.
    const hookName = this.insertOperation(TanstackQuery, args.operation).toName()
    // …
  }
}
```

The peer Definition is registered exactly once; the peer's import is
registered to BOTH variant files. Test that pins this:
`core/context/GenerateContext.cross-variant.test.ts`.

To deliberately get a per-variant peer Definition — only when the
peer is itself variants-aware AND declares the variant in its own
enrichment block — pass `{ variant: this.settings.variant }`
explicitly. The Driver throws if the peer doesn't honour it.

## Worked example

A FieldPlan section-edit case. One `PATCH /v2/quoting/quotes/{quoteId}`
endpoint, three section-edit forms.

**`client.json`:**

```jsonc
{
  "settings": {
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/v2/quoting/quotes/{quoteId}": {
          "patch": {
            "main":     { "title": "Edit Quote" },
            "customer": { "title": "Customer details", "fields": [/* … */] },
            "location": { "title": "Property location", "fields": [/* … */] }
          }
        }
      }
    }
  }
}
```

**Generated files** (after `skmtc generate`):

```
@/forms/PatchQuotesQuoteIdForm.generated.tsx           ← 'main' variant
@/forms/PatchQuotesQuoteIdFormCustomer.generated.tsx   ← 'customer' variant
@/forms/PatchQuotesQuoteIdFormLocation.generated.tsx   ← 'location' variant
@/services/usePatchQuotesQuoteId.generated.ts          ← shared TanstackQuery hook
@/types/PatchQuotesQuoteIdFormBody.generated.ts        ← 'main' body type
@/types/PatchQuotesQuoteIdFormCustomerBody.generated.ts ← 'customer' body type
@/types/PatchQuotesQuoteIdFormLocationBody.generated.ts ← 'location' body type
```

Each variant gets its own form file and its own body TS type. The
TanstackQuery hook is shared — one Definition imported by all three
form files.

## Worked example — model variants

A `gen-zod-variants` generator emits both a strict and a coercive
zod schema for the same component model.

**`client.json`:**

```jsonc
{
  "settings": {
    "enrichments": {
      "@scope/gen-zod-variants": {
        "Customer": {
          "main":     { "coerce": false },
          "coercive": { "coerce": true }
        },
        "Order": {
          "main":     { "coerce": false },
          "coercive": { "coerce": true }
        }
      }
    }
  }
}
```

**Generator `toIdentifierName` / `toExportPath` (variants-aware):**

```ts
toIdentifierName: ({ refName, variant }) =>
  withVariant(`${refName}Schema`, variant),
toIdentifierType: () => ({ type: 'variable' }),
toExportPath: ({ refName, variant }) =>
  join('@', 'schemas', `${withVariant(refName, variant)}.generated.ts`)
```

**Generated files** (after `skmtc generate`):

```
@/schemas/Customer.generated.ts            ← 'main' variant (strict)
@/schemas/CustomerCoercive.generated.ts    ← 'coercive' variant (z.coerce.*)
@/schemas/Order.generated.ts
@/schemas/OrderCoercive.generated.ts
```

Inside the Projection, branch on `this.settings.variant === 'coercive'`
(or read `this.settings.enrichments.subject?.coerce`) to pick `z.coerce.number()`
vs `z.number()`. An operation generator that needs the coercive flavour
for query-param parsing calls
`context.insertModel(ZodVariants, refName, { variant: 'coercive' })`;
`assertPeerVariantExists` throws loudly if the consumer didn't declare
that variant for the requested refName.

## Authoring a variants-aware generator

See the [`skmtc-generator`](../skills/skmtc-generator/SKILL.md) skill,
specifically the §10 task card "Authoring a variants-aware generator".
The canonical implementation is
[`skmtc-generators/gen-shadcn-form`](../../../skmtc-generators/gen-shadcn-form/)
post-`@skmtc/core@0.5.0`.

## Cross-references

- Skill: [`skills/skmtc-generator/SKILL.md`](../skills/skmtc-generator/SKILL.md) — authoring variants-aware generators (§10 task card; §4 tripwire rows; §8 anti-patterns).
- Skill: [`skills/skmtc-cli/SKILL.md`](../skills/skmtc-cli/SKILL.md) §6 + §7 — variant level in `client.json` and skip/include shape.
- Skill: [`skills/skmtc-debug/SKILL.md`](../skills/skmtc-debug/SKILL.md) Scenarios F + G — the two variant-related runtime throws.
- Concept: [`cross-generator-coordination.md`](./cross-generator-coordination.md) — how peers default to `'main'`.
- Concept: [`projections-and-snippets.md`](./projections-and-snippets.md) — `ContentSettings.variant`.
- Reference: `reference/settings/enrichments-shape.md` — the variant level in the routing diagram.
