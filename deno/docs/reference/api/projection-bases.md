# Projection bases

> The factory functions that build a generator's file-level Projection
> base class: `toTsModelProjectionBase`,
> `toTsOasOperationProjectionBase`, `toTsGqlOperationProjectionBase`
> (the authoring-facing veneers in `@skmtc/lang-typescript`) over
> core's `toModelProjectionBase`, `toOasOperationProjectionBase`,
> `toGqlOperationProjectionBase`.

A "Projection" is a named, file-level generated artifact. The three
projection flavors differ in what input they're parameterized over —
schema components (model), OAS operations, or GraphQL operations —
but share the same instance API. There are no named base classes to
extend directly: the factory *returns* the base class, configured
with the generator's statics.

## Source

Core factories (language-blind; first argument is the language
snippet base):

- `skmtc/deno/core/dsl/model/toModelProjectionBase.ts`
- `skmtc/deno/core/dsl/operation/oas/toOasOperationProjectionBase.ts`
- `skmtc/deno/core/dsl/operation/gql/toGqlOperationProjectionBase.ts`

Lang veneers (authoring-facing; pre-bind `TsSnippet` and add the
register ergonomics):

- `skmtc/deno/lang-typescript/src/toTsModelProjectionBase.ts`
- `skmtc/deno/lang-typescript/src/toTsOasOperationProjectionBase.ts`
- `skmtc/deno/lang-typescript/src/toTsGqlOperationProjectionBase.ts`

A fourth flavor exists for webhooks
(`core/dsl/webhook/toWebhookProjectionBase.ts` /
`toTsWebhookProjectionBase`); it follows the same shape and is not
separately documented here.

## The three bases

| Factory (veneer) | Source unit | Use for |
|---|---|---|
| `toTsModelProjectionBase` | A schema component (`refName`) | Generators that produce one file per type / schema (gen-typescript, gen-zod) |
| `toTsOasOperationProjectionBase` | An OAS operation (path + method) | Generators that produce one file per endpoint (gen-shadcn-form, gen-tanstack-query) |
| `toTsGqlOperationProjectionBase` | A GraphQL operation | GraphQL-side generators |

Every class the factories return extends the language snippet base
(`TsSnippet`, which extends core's `SnippetBase`), so Projections are
technically Snippets — but with substantial additional structure
(static methods, settings, projection-base convenience methods).

## Two layers: veneer and core factory

Generator code calls the single-argument veneer:

```ts fragment
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'

export const MyBase = toTsModelProjectionBase<EnrichmentSchema>(config)
```

The veneer delegates to core's two-argument factory,
`toModelProjectionBase(base, config)`, passing `TsSnippet` as the
first positional argument — the language snippet base the returned
class extends. Core stays language-blind (the base arrives as an
opaque `LangSnippetConstructor`); the language enters the hierarchy
at its root. The veneer also parameterizes the config with
`TsIdentifierType`, so `toIdentifierType`'s return type tightens to
TypeScript's entity vocabulary, and adds the `register` /
`registerInto` methods core deliberately doesn't define (see below).

## Common shape

### Factory config object

You hand this object to the veneer (e.g.
`toTsOasOperationProjectionBase(config)`). Required vs optional
matches the source type (`OasOperationProjectionBaseConfig`,
`toOasOperationProjectionBase.ts:40–76`):

```ts
{
  id: string                                  // required — generator package name
  toIdentifierName: (args) => string          // required — pure function: the cache-key name
  toIdentifierType: (subject, context) => IdentifierType
                                              // required — the non-name identifier parts,
                                              //   e.g. () => ({ type: 'variable' })
  toExportPath: (args) => string              // required — pure function: file path from input
  toEnrichmentSchema: () => v.GenericSchema<E>  // required — declare accepted enrichment shape
  toEnrichmentDefaults?: (args) => E | undefined  // optional (model and OAS only) — seed values
  isSupported?: (args) => boolean             // optional — defaults to `() => true`
}
```

- **`toIdentifierName`** and **`toExportPath`** are *load-bearing
  pure functions*. They produce the cache key for cross-generator
  coordination. Same inputs → same key. Both receive
  `{ refName | operation, enrichments, variant }`.
- **`toIdentifierType`** returns the *non-name* parts of the
  identifier — `{ type, typeName?, exported? }`
  (`core/dsl/IdentifierType.ts`). It is context-aware and runs only
  on cache-miss; the engine assembles the full identifier as
  `lang.toIdentifier({ name: toIdentifierName(args), ...toIdentifierType(subject, context) })`.
  Under the TypeScript veneer the return is `TsIdentifierType`, whose
  `type` is bound to `TsEntityType`
  (`'variable' | 'type' | 'class' | 'interface' | 'namespace'`).
  For most value-producing generators this is
  `() => ({ type: 'variable' })`.
- **`toEnrichmentSchema`** is **required** — required (not optional)
  is load-bearing: it is what lets the factory-built
  `static toEnrichments` parse cast-free. It returns the Valibot
  schema for the `{ subject, generator, stack }` enrichment umbrella.
  A generator with no enrichments passes `emptyEnrichmentSchema`
  (exported from `@skmtc/core`, defined in
  `core/types/Enrichments.ts`) — every member is `v.undefined()`, so
  an unexpected payload fails loud rather than being silently
  swallowed.
- **`isSupported`** is the family-level applicability predicate.
  Omit to advertise support for every item.

Note: **`toEnrichments` is not a config field.** The factory builds
it from `toEnrichmentSchema` and the project's enrichment settings
and exposes it as a class static (see below).

### Class statics produced by the factory

The factory returns a class with the following statics
(`toOasOperationProjectionBase.ts:110–151`,
`toModelProjectionBase.ts:124–154`):

| Static | Source |
|---|---|
| `id` | `config.id` |
| `type` | factory-hardcoded discriminator (`'oasOperation'`, `'gqlOperation'`, or `'model'`) |
| `toIdentifierName` | `config.toIdentifierName` |
| `toIdentifierType` | `config.toIdentifierType` |
| `toExportPath` | `config.toExportPath` |
| `isSupported` | `config.isSupported ?? (() => true)` |
| `toEnrichments` | factory-built; assembles the `{ subject, generator, stack }` umbrella from `context.settings.enrichments` and parses it against `config.toEnrichmentSchema()` |
| `toEnrichmentDefaults` | delegates to `config.toEnrichmentDefaults`; returns `undefined` when omitted (model and OAS factories only) |
| `lang` | inherited from the language snippet base (`TsSnippet.lang`) — the Drivers read it off the class, pre-construction |

`toEnrichments` reads the subject scope per item —
`enrichments[id][refName][variant]` (model),
`enrichments[id][path][method][variant]` (OAS),
`enrichments[id][rootKind][fieldName][variant]` (GQL) — plus the
run-constant `enrichments[id]._generator` and `enrichments._stack`
scopes.

The `type` static is the discriminator the engine's dispatcher reads
to route entries against the right protocol — operation generators
built via the OAS factory only fire on OAS documents, GraphQL ones
only on GraphQL documents.

### Instance properties

- `context: GenerateContextType` — inherited from `SnippetBase`
- `settings: ContentSettings<EnrichmentType>` — computed by the
  Driver. Has `identifier`, `exportPath`, `enrichments`, `variant`.
- `operation: OasOperation | GqlOperation` (operation bases only) —
  the source operation.
- `refName: RefName` (model base only) — the source schema's refName.

The factory constructor injects `generatorKey` (composed from the
generator id, the operation/refName, and the variant) into the
snippet-base super call, so subclasses don't construct it.

### Instance methods

The projection-base convenience layer auto-fills `destinationPath`
from `this.settings.exportPath`:

```ts
// Operation bases (OAS and GQL)
insertOperation<V, E>(
  projection: OperationProjection<V, E>,
  operation: OasOperation | GqlOperation,
  options?: { noExport?: boolean; variant?: string }
): Inserted<V, E>

// All bases
insertModel<V, E>(
  projection: ModelProjection<V, E>,
  refName: RefName,
  options?: { noExport?: boolean; variant?: string }
): Inserted<V, E>

insertNormalizedModel<V, S, E>(
  projection: ModelProjection<V, E>,
  args: { schema: S, fallbackName: string },  // ← no destinationPath needed
  options?: { noExport?: boolean; variant?: string }
): InsertNormalizedModelReturn<V, S>
```

These delegate to the corresponding methods on `GenerateContext`,
filling in `destinationPath: this.settings.exportPath`. Generator
code typically uses these wrappers rather than the underlying
context methods directly.

`defineAndRegister(args)` is inherited from `TsSnippet` — it builds a
`TsDefinition` and registers it, but takes an explicit
`destinationPath` (`TsDefineAndRegisterArgs`,
`lang-typescript/src/register.ts`).

### `register` lives on the lang veneer — core defines none

Core's factories deliberately define **no** `register` — register
ergonomics are typed by each language's concise vocabulary, which
core can't name. The override lives in the language package's
projection-base veneer (`toTsModelProjectionBase.ts:38–49` and
siblings), which adds two methods:

```ts
// Own-file: destinationPath is always this projection's settings.exportPath
register(args: TsRegisterArgs): void

// Explicit cross-file path
registerInto(destinationPath: string, args: TsRegisterArgs): void
```

`TsRegisterArgs` (`lang-typescript/src/register.ts:23`) has
`imports?`, `reExports?`, `definitions?`, `custom?` — and *no*
`destinationPath`. Both methods delegate to the lang package's
`register` *function*, which converts the concise import form into
`TsImport` objects, creates the destination `TsFile` on first write,
and hands pure data to the neutral `context.register` — whose
argument type is `ContextRegisterArgs`
(`core/context/generateTypes.ts:308`): standardized `ImportBase[]` /
`ReExportBase[]` / `DefinitionBase[]` plus a required
`destinationPath: string`.

Snippets sit one level down: `TsSnippet.register` takes
`TsRegisterArgs & { destinationPath: string }` — a snippet has no
`settings.exportPath`, so the parent must supply the target file
explicitly.

Mechanical consequence on a Projection:

```ts
class MyProjection extends MyGenBase {
  constructor(args) {
    super(args)

    // ✅ Correct: no destinationPath. register targets the
    //   projection's own export file.
    this.register({
      imports: { 'my-runtime-lib': ['someHelper'] }
    })

    // ❌ Fails typecheck: TS2353 — 'destinationPath' does not exist
    //   in type 'TsRegisterArgs'. Use registerInto for another file.
    this.register({
      imports: { 'my-runtime-lib': ['someHelper'] },
      destinationPath: this.settings.exportPath
    })
  }
}
```

`register` removes the caller's ability to choose `destinationPath`
because a Projection has a single legitimate default target file —
its own `settings.exportPath`. Writing into a file the Projection
doesn't own is an explicit act, spelled `registerInto(path, args)`.

## Factory functions

The factories take a configuration object and return a class
constructor. Generator authors call the factory to produce a base
class, then extend it.

### `toTsOasOperationProjectionBase<E>(config)`

```ts
// gen-shadcn-form/src/base.ts (abridged; real source)
import { camelCase, capitalize, toMethodVerb, withVariant } from '@skmtc/core'
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const ShadcnFormBase = toTsOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  toEnrichmentSchema,

  toIdentifierName({ operation, variant }): string {
    const verb = capitalize(toMethodVerb(operation.method))
    const base = `${verb}${camelCase(operation.path, { upperFirst: true })}Form`

    return withVariant(base, variant)
  },

  toIdentifierType: () => ({ type: 'variable' }),

  toExportPath({ operation, enrichments, variant }): string {
    const name = this.toIdentifierName({ operation, enrichments, variant })

    return join('@', 'forms', `${name}.generated.tsx`)
  }
})
```

The returned base is then extended by the actual Projection class:

```ts
class ShadcnForm extends ShadcnFormBase {
  constructor(args: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super(args)
    // ...
  }

  override toString(): string {
    return `...`
  }
}
```

### `toTsGqlOperationProjectionBase<E>(config)`

Same shape as OAS but for GraphQL operations. The `operation`
parameter has the GQL operation shape (root kind, field name). The
GQL config has no `toEnrichmentDefaults` field.

### `toTsModelProjectionBase<E>(config)`

Same shape but the parameter is `{ refName, enrichments, variant }`
instead of `{ operation, enrichments, variant }`. Used for
generators that produce one file per schema component.

```ts
// gen-zod/src/base.ts (real source)
import { camelCase, decapitalize } from '@skmtc/core'
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const ZodBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  toIdentifierName({ refName }): string {
    return decapitalize(camelCase(refName))
  },

  toIdentifierType: () => ({ type: 'variable' }),

  toExportPath({ refName, enrichments, variant }): string {
    const name = this.toIdentifierName({ refName, enrichments, variant })

    return join('@', 'types', `${decapitalize(name)}.generated.ts`)
  },

  toEnrichmentSchema
})
```

## Pure function requirement

`toIdentifierName` and `toExportPath` **must be pure functions** of
their inputs:

- No `this`-side state. (Hence why they're static — `this` isn't an
  instance.)
- No async. Synchronous return.
- No environmental reads (no `Date`, `Math.random`, `process.env`,
  etc.).

The reason: their outputs become the cache key for cross-generator
coordination. If `toIdentifierName(args)` returned different names
on successive calls, the cache would lose its uniqueness invariant
and the order-independence guarantee would break.

`toIdentifierType` is deliberately *not* under this constraint: it
receives the `context` and runs only on cache-miss, so it may derive
the declaration type from the resolved schema.

The purity invariant is **convention-enforced, not type-enforced**.
The TypeScript type signature doesn't prevent impurity; relying on
convention is the cost of the design choice.

See [cross-generator-coordination concept](../../concepts/cross-generator-coordination.md#identifier-and-exportpath-are-pure-functions).

## Instance construction

The Projection's constructor signature varies by base
(`dsl/operation/oas/types.ts:14`, `toModelProjectionBase.ts:34`):

```ts
// Operation projection
type OasOperationProjectionConstructorArgs<E = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<E>
  operation: OasOperation
}

// Model projection
type ModelProjectionArgs<E = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<E>
  refName: RefName
}
```

The Driver constructs the Projection with these args; generators
write the constructor body that:

1. Calls `super(args)`
2. Composes with peer generators via `insertOperation` /
   `insertNormalizedModel`
3. Registers imports via `this.register({ imports })` (own-file;
   `registerInto` for any other file)

## Common questions

### Why static methods instead of methods on the instance?

`toIdentifierName` and `toExportPath` are called by the Driver
*before* the Projection instance exists — the Driver needs them to
compute the cache key, which determines whether to construct the
instance at all. Static-on-class is the right shape for "available
without an instance."

### Can I override `toIdentifierName` per instance?

No. The static methods are bound to the class via the factory.
Per-instance variation would defeat the cache-key purity invariant
(different instances would compute different names for the same
input, breaking memoization).

If you need per-operation variation in identifier shape, encode it
in `toIdentifierName({ operation, enrichments, variant })` — make
the function branch on properties of the operation or enrichment
payload.

### What if I want to extend an existing projection base?

You can extend the class produced by the factory, but the static
methods are bound at factory time — overriding them in a subclass
is brittle (the cached factory-produced methods take precedence in
most paths).

The cleanest pattern is to use the factory directly with your own
configuration. If you're extending a stock generator, clone-then-
edit `src/base.ts` rather than subclassing.

### What's the relationship between the projection base's `insertOperation` and `GenerateContext.insertOperation`?

The projection-base method wraps the context method, auto-filling
`destinationPath` from `this.settings.exportPath`. So:

```ts
this.insertOperation(Peer, op)
// ≡
this.context.insertOperation({
  projection: Peer,
  operation: op,
  destinationPath: this.settings.exportPath
})
```

Generators almost always use the projection-base form because it
reads cleaner and gets the destination right by default.

### Why is `defineAndRegister` available on projection instances?

It's inherited from the language snippet base (`TsSnippet`), for the
rare case of registering a Definition directly without going through
a peer Projection. Useful for small inline values (a constants
table, a default-values object) that need to be rendered as
`export const X = ...` but don't justify a full Projection of their
own. Note it takes an explicit `destinationPath`.

Direct `defineAndRegister` bypasses cross-generator coordination
(the resulting Definition isn't discoverable via `insertOperation`
from other generators). Use only for definitions that don't need
cross-generator discoverability.

## Related types

```ts
// Constructor argument shapes
type OasOperationProjectionConstructorArgs<E = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<E>
  operation: OasOperation
}

type GqlOperationProjectionConstructorArgs<E = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<E>
  operation: GqlOperation
}

type ModelProjectionArgs<E = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<E>
  refName: RefName
}

// Static-method argument shapes (OAS shown; model swaps operation → refName)
type ToOasOperationIdentifierNameArgs<E = undefined> = {
  operation: OasOperation
  enrichments: E
  variant: string
}

type ToOasOperationExportPathArgs<E = undefined> = {
  operation: OasOperation
  enrichments: E
  variant: string
}
```

## See also

- [API: SnippetBase](dsl-snippet-base.md) — what projection bases extend
- [API: GenerateContext](generate-context.md) — what the projection-base methods delegate to
- [API: Identifier](dsl-identifier.md) — `toIdentifierName` / `toIdentifierType` and the identifier data model
- [API: ContentSettings](content-settings.md) — what `settings` carries
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) — the two-level model
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) — pure functions and the cache
- [Authoring tutorials](../../authoring/tutorials/02-authoring-a-model-generator.md) — building on these bases end to end
