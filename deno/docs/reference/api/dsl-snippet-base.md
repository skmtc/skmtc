# SnippetBase

> The root class for all DSL elements. Provides `context`,
> `generatorKey`, and the `register()` method. Both Projections and
> anonymous Snippets descend from it (directly or via the projection
> bases).

## Source

`skmtc/deno/core/dsl/SnippetBase.ts`

## Class

```ts
class SnippetBase {
  context: GenerateContextType
  skipped: boolean = false
  generatorKey: GeneratorKey | undefined

  constructor(args: {
    context: GenerateContextType
    generatorKey?: GeneratorKey
  })

  register(args: RegisterArgs): void
}
```

That's the entire class. ~40 lines including types. The reason it's
foundational despite its size: every DSL element ultimately
descends from it, which means `register` and `context` are
universally available.

## Constructor

```ts
new SnippetBase({
  context: GenerateContextType,
  generatorKey?: GeneratorKey  // optional; usually set by subclasses
})
```

Subclasses pass `context` through `super({ context })`. The
projection bases pass `generatorKey` as well, derived from the
generator's `id` and the operation/refName.

You rarely instantiate `SnippetBase` directly — you subclass it.

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

The generator key — a composite of `generatorId` and the
operation/refName. Used by `affirmDefinition` to verify cache-hit
integrity in the Driver flow.

Set by the projection bases. Anonymous Snippets typically have
`undefined` here (they don't participate in the cache directly;
their parent Projection does).

## Methods

### `register(args: RegisterArgs): void`

Forwards to `context.register(args)`. Provides convenient access
from any DSL element to the file-map mutation surface.

```ts
type RegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, Identifier[]>
  definitions?: (Definition | undefined)[]
  destinationPath: string
}
```

**Idempotent.** Repeated calls with the same payload are safe —
imports dedupe via `Set`, definitions first-write-wins via
`File.definitions.has(name)`.

The shape of `ImportNameArg`:

```ts
type ImportNameArg = string | { name: string; alias?: string; isType?: boolean }
```

Plain strings are equivalent to `{ name: 'X' }`. The object form is
needed only for aliased imports or `isType: true` (type-only
imports).

## Extending SnippetBase

Two patterns:

### Pattern A: extend directly (anonymous Snippet)

```ts
class MyFieldSnippet extends SnippetBase {
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
  // MyGenBase is constructed via toOasOperationProjectionBase(...)
  // and extends OasOperationProjectionBase, which extends SnippetBase.

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
enrichments) and the `insertOperation` / `insertModel` /
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

## Common questions

### Why is `register` on SnippetBase rather than on `GenerateContext` only?

Both Projections and Snippets need to register imports and
definitions. Having `register` on the shared base means every DSL
element has the same primitive without having to thread `context`
through `register` calls. The forwarding is trivial; the convenience
is significant.

### Should I extend SnippetBase or a projection base?

- **Anonymous fragment** (e.g., a single field, a JSX element, a
  partial expression) → extend `SnippetBase` directly.
- **Named, exportable artifact** (e.g., a hook, a form component, a
  validation schema) → extend a projection base
  (`OasOperationProjectionBase`, `ModelProjectionBase`,
  `GqlOperationProjectionBase`).

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

A branded string type — typically formatted as
`generatorId:operationOrRefName`. Used by the Driver's
`affirmDefinition` to verify that a cached Definition came from the
same generator. The branding prevents misuse (you can't pass a
plain string where a `GeneratorKey` is expected).

Anonymous Snippets don't need a `generatorKey` — they're not
cached directly. Projections inherit theirs from the projection
base's constructor.

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
// What register accepts
type RegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, Identifier[]>
  definitions?: (Definition | undefined)[]
  destinationPath: string
}

// Per-import shape
type ImportNameArg = string | {
  name: string
  alias?: string
  isType?: boolean
}

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
