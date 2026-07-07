# SnippetBase

> The root class for all DSL elements. Provides `context` plus the
> optional attribution inputs `generatorKey` and `stackTrail`. Both
> Projections and anonymous Snippets descend from it — via a language
> snippet base such as `TsSnippet`, which is where `register` lives.

## Source

`skmtc/deno/core/dsl/SnippetBase.ts` (core, language-blind) and
`skmtc/deno/lang-typescript/src/TsSnippet.ts` (the TypeScript
snippet base generators actually extend).

## Class

```ts
// core — language-blind; has NO register
class SnippetBase {
  context: GenerateContextType
  skipped: boolean = false
  generatorKey: GeneratorKey | undefined
  stackTrail: StackTrail

  constructor(args: {
    context: GenerateContextType
    generatorKey?: GeneratorKey   // attribution (gen-maps) input only
    stackTrail?: StackTrail       // attribution input only
  })
}

// lang-typescript — the authoring base
class TsSnippet extends SnippetBase {
  static lang: Lang

  register(args: TsRegisterArgs & { destinationPath: string }): void
  defineAndRegister<V>(args: TsDefineAndRegisterArgs<V>): TsDefinition<V>
}
```

`SnippetBase` is **language-blind**: it has no `register` and no
language. Register ergonomics live on each language package's
snippet base (`TsSnippet.register` delegates to that package's
`register` function) — a raw `SnippetBase` subclass that tries to
register is a compile-time error. The reason the base is
foundational despite its size: every DSL element ultimately descends
from it, which means `context` (and the attribution capture wiring)
is universally available.

## Constructor

```ts
new TsSnippet({
  context: GenerateContextType,
  generatorKey?: GeneratorKey,  // optional attribution input
  stackTrail?: StackTrail       // optional attribution input; clone at the call site
})
```

Subclasses pass `context` through `super({ context })`. The
projection-base factories pass `generatorKey` as well, derived from
the generator's `id`, the operation/refName, and the variant.
Snippets built from a schema node pass
`stackTrail: schema.stackTrail.clone()` so attribution (gen-maps)
can point output back at the source fragment.

You rarely instantiate the bases directly — you subclass `TsSnippet`
(or extend a projection base built on it).

## Properties

### `context: GenerateContextType`

The Generate-phase context. Every Snippet and Projection has access
to it. Used for `findDefinition` lookups, cross-generator
coordination (in the rare Snippet case), and indirect access to the
file map.

### `skipped: boolean`

A flag indicating the Snippet was filtered out by some upstream
process. Default `false`. Used by the engine; subclasses rarely
read or write it directly.

### `generatorKey: GeneratorKey | undefined`

The generator key — a branded, pipe-delimited composite of
`generatorId`, the operation/refName, and the variant. On
`SnippetBase` it is an **optional attribution input only** (gen-maps
provenance) — snippet `register` is keyless. The Driver-side
`affirmDefinition` integrity check builds its own key from the
projection statics.

Set by the projection-base factory constructors. Anonymous Snippets
typically have `undefined` here (they don't participate in the
cache directly; their parent Projection does).

### `stackTrail: StackTrail`

Position of the schema fragment this snippet was built from —
attribution input only. Pass a clone
(`schema.stackTrail.clone()`); the empty trail means "no single
originating node".

## Methods (on `TsSnippet`)

### `register(args: TsRegisterArgs & { destinationPath: string }): void`

Delegates to the lang package's `register` function
(`lang-typescript/src/register.ts`), which converts the concise
import form to `TsImport` objects, creates the destination `TsFile`
on first write, and hands pure data (`ContextRegisterArgs`) to the
neutral `context.register`.

```ts
type TsRegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, TsIdentifier[]>
  definitions?: (DefinitionBase | undefined)[]
  custom?: Stringable
}
```

`destinationPath` is always **explicit** on snippets: a snippet has
no file or settings of its own, so the parent passes the target path
through. Own-file defaulting exists only on Projections, in the
projection-base veneers.

**Idempotent.** Repeated calls with the same payload are safe —
imports merge per module via `TsImport.merge`, definitions
first-write-wins per declaration slot.

The shape of `ImportNameArg`:

```ts
type ImportNameArg =
  | string                                            // 'X' — plain value import
  | { [name: string]: string }                        // { merge: 'lodashMerge' } — rename form
  | { name: string; alias?: string; type?: TsEntityType }  // full form
```

Plain strings are equivalent to `{ name: 'X' }`. The full form is
needed only for aliased imports or `type: 'type'` (type-only
imports).

### `defineAndRegister<V>(args: TsDefineAndRegisterArgs<V>): TsDefinition<V>`

Build a `TsDefinition` from `{ identifier, value, destinationPath,
description?, leadingComment?, noExport? }` and register it in one
call.

## Extending the snippet base

Two patterns:

### Pattern A: extend `TsSnippet` directly (anonymous Snippet)

```ts
class MyFieldSnippet extends TsSnippet {
  name: string
  label: string | undefined

  constructor({
    context, name, label, destinationPath
  }: { context: GenerateContextType; name: string; label?: string; destinationPath: string }) {
    super({ context })
    this.name = name
    this.label = label

    this.register({
      imports: { '@/components/fields/string-field': ['StringField'] },
      destinationPath
    })
  }

  toString(): string {
    return `<StringField name="${this.name}"${this.label ? ` label="${this.label}"` : ''} />`
  }
}
```

Notes:

- Constructor takes `destinationPath` explicitly (Snippets don't
  have their own exportPath).
- `register` runs in the constructor — imports are accumulated
  before `toString()` is ever called.
- `toString()` is pure: derived from `this.*` fields set in the
  constructor.

### Pattern B: extend through a projection base (named Projection)

```ts
class MyProjection extends MyGenBase {
  // MyGenBase is constructed via toTsOasOperationProjectionBase(...)
  // and extends TsSnippet, which extends SnippetBase.

  constructor(args: OasOperationProjectionConstructorArgs<MyEnrichmentSchema>) {
    super(args)
    // ... can call this.register, this.insertOperation, etc.
  }

  override toString(): string {
    return `... ${this.someField} ...`
  }
}
```

The projection base wires up `settings` (identifier + exportPath +
enrichments + variant), the own-file `register` / `registerInto`
overrides, and the `insertOperation` / `insertModel` /
`insertNormalizedModel` convenience methods.

## The toString() contract

`SnippetBase` doesn't declare `toString()` as abstract, but
**every meaningful Snippet must override it**. Without `toString()`,
the default `Object.prototype.toString` returns `"[object Object]"`
— template-literal interpolation produces garbage output.

Subclasses should:

- Return a string deterministically from `this.*` fields
- Not mutate `this` (`toString` may be called multiple times)
- Not perform side effects (register, etc. — those go in the
  constructor)
- Declare `toString` as a **prototype method, never an instance
  field** — every instance self-wraps its `toString` at construction
  for attribution capture (gen-maps), and an arrow-function field
  would overwrite the wrapper

## Common questions

### Why is `register` on the snippet base rather than on `GenerateContext` only?

Both Projections and Snippets need to register imports and
definitions, typed by their language's concise vocabulary — which
core can't name. Putting `register` on the *language* snippet base
(`TsSnippet`) gives every DSL element the same primitive without
threading `context` around, while keeping core's `context.register`
a pure-data seam. Core's `SnippetBase` itself has no `register`.

### Should I extend `TsSnippet` or a projection base?

- **Anonymous fragment** (e.g., a single field, a JSX element, a
  partial expression) → extend `TsSnippet` directly.
- **Named, exportable artifact** (e.g., a hook, a form component, a
  validation schema) → extend a projection base built by
  `toTsOasOperationProjectionBase` / `toTsModelProjectionBase` /
  `toTsGqlOperationProjectionBase`.

The deciding question: does this need its own name and file? If
yes, Projection; if no, Snippet. See
[projections-and-snippets concept](../../concepts/projections-and-snippets.md).

### Can a Snippet have a `register` call without a `toString()`?

Technically yes — a Snippet that just registers imports and then
isn't embedded anywhere would still get its imports collected.
But this is a code smell: a Snippet exists to be embedded. If
you're registering imports without producing output, consider
whether the parent should just do the registration directly.

### Why isn't `toString()` abstract on SnippetBase?

Historical: making it abstract would force subclasses to declare
it explicitly even when inheriting from a parent that already does.
The current approach trusts subclasses to override appropriately.
A more disciplined version would make it abstract; the choice not
to was pragmatic.

### What's `GeneratorKey`?

A branded, pipe-delimited string type — 4 segments for operations
(`id|path|method|variant` OAS, `id|rootKind|fieldName|variant` GQL),
3 for models (`id|refName|variant`), 1 for generator-only. Used by
the Driver's `affirmDefinition` to verify that a cached Definition
came from the same generator, and by attribution (gen-maps) as a
provenance label. The branding prevents misuse (you can't pass a
plain string where a `GeneratorKey` is expected).

Anonymous Snippets don't need a `generatorKey` — they're not
cached directly; on a snippet it is optional attribution input.
Projections get theirs injected by the projection-base factory
constructor.

## Stringable

A loose convention: anything with a `toString()` method that
produces meaningful output is "Stringable." Every `SnippetBase`
descendant is Stringable. So is anything else with a
`toString()` (built-in arrays, custom value types, etc.).

The DSL composes via template-literal interpolation, which calls
`String()` on interpolated values, which falls back to
`toString()`. So `${anySnippet}` just works.

## Related types

```ts
// What TsSnippet.register accepts (plus destinationPath)
type TsRegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, TsIdentifier[]>
  definitions?: (DefinitionBase | undefined)[]
  custom?: Stringable
}

// Per-import shape
type ImportNameArg =
  | string
  | { [name: string]: string }
  | { name: string; alias?: string; type?: TsEntityType }

// Generator-key brand
type GeneratorKey = string & { __brand: 'GeneratorKey' }
```

## See also

- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) — the two-level model
- [API: GenerateContext](generate-context.md) — what `register` forwards to
- [API: Definition](dsl-definition.md) — what `register({ definitions })` accepts
- [API: Identifier](dsl-identifier.md) — what `reExports` and import names use
- [API: Projection bases](projection-bases.md) — what extends SnippetBase via the projection layer
- [`skmtc-generator` skill §6](../../skills/skmtc-generator/SKILL.md) — Snippet scaffold (Pattern A)
