# Identifier

> A name with an entity-type marker (`'variable'` vs `'type'`). Created
> via factory methods, used as the key in cross-generator
> coordination, and propagated into imports with the correct
> `import { X }` vs `import { type X }` syntax.

`Identifier` carries the entity-type tracking that makes correct
import emission possible under `verbatimModuleSyntax: true`. The
entity-type discriminator distinguishes runtime-value imports from
type-only imports — a distinction TypeScript enforces at compile
time when `verbatimModuleSyntax` is enabled.

## Source

`skmtc/deno/core/dsl/Identifier.ts`
(and `core/dsl/EntityType.ts` for the entity-type discriminator)

## Class

```ts
class Identifier {
  name: string
  typeName?: string
  entityType: EntityType                // class wrapping the EntityTypeValue literal

  // Factory methods (preferred construction path)
  static createVariable(name: string, typeName?: string): Identifier
  static createType(name: string): Identifier

  // Direct constructor (private — use the factory methods)
  private constructor(args: {
    name: string
    typeName?: string
    entityType: EntityType
  })

  // Methods
  toImport(): ImportNameArg
  toString(): string
}
```

## EntityType

The discriminator that distinguishes runtime values from types.

```ts
// core/dsl/EntityType.ts
export type EntityTypeValue = 'variable' | 'type'

export class EntityType {
  type: EntityTypeValue   // the literal discriminator
  constructor(type: EntityTypeValue) { this.type = type }
}
```

`Identifier.entityType` is an `EntityType` *instance*, not the
literal. To check which kind it is, read the wrapped value:

```ts
identifier.entityType.type === 'variable'   // ✓ correct
identifier.entityType.type === 'type'       // ✓ correct
identifier.entityType === 'variable'        // ✗ compares object to string (always false)
```

Two values:

- **`'variable'`** — a runtime value. Renders as `import { X } from '...'`.
  Example: a Zod schema (`export const userBody = z.object({...})`),
  a hook (`export const useCreateUser = ...`). Note the
  discriminator value is `'variable'`; the *rendered* declaration
  keyword is `const`.

- **`'type'`** — a TypeScript type. Renders as
  `import { type X } from '...'` under `verbatimModuleSyntax`.
  Example: a TypeScript type alias
  (`export type UserBody = { ... }`).

The split matters because TypeScript's `verbatimModuleSyntax: true`
requires type-only imports to be marked explicitly. Without entity
tracking, the engine couldn't distinguish a Zod schema (value) from
a TypeScript type when both are imported into a form file — and
the resulting `import { UserBody, userBody } from '...'` would be
wrong if either was a type.

The `EntityType` class (in `EntityType.ts`) maps these literal values
to the corresponding TypeScript keyword strings. The codebase's
recent refactor (`isType` boolean → `EntityTypeValue` literal) made
this discrimination explicit instead of implicit. Generators don't
typically interact with the `EntityType` class directly — they use
`Identifier.createVariable` and `Identifier.createType`, which set
the right `entityType` value internally.

## Factory methods

The preferred construction paths:

### `Identifier.createVariable(name, typeName?): Identifier`

Creates a runtime-value identifier. Emits as
`import { name } from '...'`.

```ts
const userBody = Identifier.createVariable('userBody')
// → entityType.type === 'variable'

const useCreateUser = Identifier.createVariable('useCreateUser', 'UseMutationResult<...>')
// → entityType.type === 'variable', typeName: 'UseMutationResult<...>'
//   (renders `export const useCreateUser: UseMutationResult<...> = ...`)
```

The optional `typeName` is appended in the declaration:

```ts
// With typeName
export const useCreateUser: UseMutationResult<...> = (...) => { ... }

// Without typeName
export const userBody = z.object({ ... })
```

Most generators omit `typeName` and let TypeScript infer.

### `Identifier.createType(name): Identifier`

Creates a TypeScript-type identifier. Emits as
`import { type name } from '...'` under `verbatimModuleSyntax`.

```ts
const UserBody = Identifier.createType('UserBody')
// → entityType.type === 'type'
```

The declaration uses `export type`:

```ts
export type UserBody = { name: string; email: string }
```

### Direct construction (not exposed)

`Identifier`'s constructor is private; the factory methods
(`createVariable`, `createType`) are the only public construction
path. They internally construct the `EntityType` instance and
pass it to the constructor:

```ts
// Inside Identifier.createVariable, simplified:
return new Identifier({
  name,
  typeName,
  entityType: new EntityType('variable')
})
```

If you need a conditional discriminator, branch on the factory
method instead of constructing directly.

## Properties

### `name: string`

The identifier name as it appears in the generated code. Must be a
valid JavaScript identifier (the codebase uses `isIdentifierName`
from Babel for validation when necessary).

### `typeName?: string`

Optional type annotation appended to a `createVariable` identifier:

```ts
// With typeName:
const ident = Identifier.createVariable('x', 'number')
// Emitted:
export const x: number = 42

// Without typeName:
const ident = Identifier.createVariable('x')
// Emitted (type inferred):
export const x = 42
```

`typeName` is meaningful only when `entityType.type === 'variable'`.
For `'type'` identifiers, the type itself is the value, so there's
no separate type annotation.

### `entityType: EntityType`

An `EntityType` instance wrapping a `'variable' | 'type'` literal.
Set by the factory methods; checked at import time (via
`entityType.type`) to decide between `import { X }` and
`import { type X }`.

## Methods

### `toImport(): ImportNameArg`

Returns an `ImportNameArg` representation suitable for
`register({ imports })`. Carries the entity-type information so the
import is emitted with the right shape:

```ts
const ident = Identifier.createType('UserBody')
const importArg = ident.toImport()
// → { name: 'UserBody', type: 'type' }

this.register({
  imports: {
    '@/types/User.generated': [importArg]
  },
  destinationPath
})
// Renders as: import { type UserBody } from '@/types/User.generated'
```

For `'variable'` identifiers, `toImport()` returns the **name as a
plain string** (not an object). The object form is only produced
for `'type'` identifiers, or when an `alias` is supplied — see
`core/dsl/Identifier.ts` `toImport()` for the branching.

### `toString(): string`

Returns just the `name`. Used when the identifier appears in
template literals:

```ts
override toString() {
  return `const x = ${this.someIdentifier}()`
  //                  ^^^^^^^^^^^^^^^^^^^^ ← .toString() called implicitly
}
```

`typeName` is *not* included in `toString()` — it's only emitted at
declaration time (via `Definition.toString()`).

## verbatimModuleSyntax — why it matters

TypeScript's `verbatimModuleSyntax: true` is a stricter import mode
that:

- Requires type-only imports to be explicitly marked:
  `import { type X }` instead of `import { X }`
- Forbids imports that exist only for side effects to be removed at
  emit time

Without entity-type tracking, the engine would emit ambiguous
imports under verbatim mode:

```ts
// Without entity-type tracking:
import { UserBody, userBody } from '@/generated/User'
// ❌ TS error under verbatimModuleSyntax — UserBody is a type but
// imported as a value
```

With entity-type tracking:

```ts
// With entity-type tracking:
import { type UserBody, userBody } from '@/generated/User'
// ✓ Correct under verbatimModuleSyntax
```

This is the load-bearing reason for the recent refactor from a
boolean `isType` flag to the `EntityTypeValue` literal. The literal
participates in TypeScript's discriminated-union narrowing; the
boolean did not. All current API surface uses
`type: 'variable' | 'type'` — `isType` is gone.

## Examples

### A Projection's `toIdentifier` factory

```ts
// gen-zod/src/base.ts
toIdentifier({ operation }): Identifier {
  const name = `${decapitalize(toEndpointName(operation))}Body`
  return Identifier.createVariable(name)
}
```

The Zod Projection emits a *runtime value* (a Zod schema), so it
uses `createVariable`. The resulting `Definition` emits as
`export const <name> = z.object({...})`.

### TypeScript-type generator's `toIdentifier`

```ts
// gen-typescript/src/base.ts
toIdentifier({ operation }): Identifier {
  const name = capitalize(toEndpointName(operation)) + 'Body'
  return Identifier.createType(name)
}
```

The TS-type Projection emits a *type alias*, so it uses
`createType`. The resulting `Definition` emits as
`export type <Name> = { ... }`.

### Mixed-import emission

When a form file imports both a Zod schema (value) and a TypeScript
type from the same module:

```ts
// In the form Projection's constructor
const zod = this.insertNormalizedModel(ZodProjection, {...})
const ts = this.insertNormalizedModel(TsProjection, {...})

this.register({
  imports: {
    '@/generated/User': [
      zod.identifier.toImport(),    // bare string: 'userBody'
      ts.identifier.toImport()      // { name: 'UserBody', type: 'type' }
    ]
  },
  destinationPath
})
```

Emits:

```ts
import { userBody, type UserBody } from '@/generated/User'
```

The mixed-import syntax is supported by `verbatimModuleSyntax` —
both runtime value and type imported from the same statement, with
the type-only one explicitly marked.

## Common questions

### Why not just use TypeScript's structural distinction (value vs type)?

The engine emits code; it doesn't have a TypeScript type-checker
available. By the time imports are being collected, the engine
only knows what generators have *told* it. The `EntityTypeValue`
discriminator is how that information flows from the generator's
declaration to the import emission.

Without the tracking, the engine would have to either always emit
type imports (over-marking — fails for value imports) or never
emit them (under-marking — fails under `verbatimModuleSyntax`).

### Can I have an identifier that's both a value and a type?

In TypeScript yes (classes have both runtime and type
representations). But Identifier doesn't model this — pick one.
For most generator output, the distinction is clear: a Zod schema
is a value, a TypeScript alias is a type, a hook is a value, etc.

If you genuinely need both, register the identifier twice (once
as `createVariable`, once as `createType`) and emit both imports.
This is rare.

### What's `typeName` for if it's optional?

When you want the declaration to include an explicit type
annotation:

```ts
// With typeName: 'UseQueryResult<UserData>'
export const useUser: UseQueryResult<UserData> = (...) => { ... }
```

Useful when type inference would produce a less-helpful inferred
type. Most generators skip it and rely on inference.

### Why not just use raw strings for identifiers?

This is a common LLM intuition that's wrong here. Raw strings:

- Don't carry entity-type information → wrong imports under
  `verbatimModuleSyntax`
- Aren't validated → might be invalid JS identifiers
- Can't be deduplicated across the file structurally

The `Identifier.createVariable` / `Identifier.createType` factory
methods are mandatory in generator code. The
[skmtc-generator skill anti-patterns table](../../skills/skmtc-generator/SKILL.md)
explicitly forbids raw strings as identifier names.

### Where does the `EntityType` *class* fit in?

The class in `core/dsl/EntityType.ts` is a thin mapper from the
`EntityTypeValue` literal to the corresponding TypeScript keyword
(`const` or `type`) used in declaration emission. It's mostly an
implementation detail; generator authors interact with the literal
values via `Identifier.create*`, not with the class directly.

The class existed historically with more responsibility; the recent
refactor narrowed it to the keyword mapping. The literal
`EntityTypeValue` is now the primary discriminator carrying the
distinction through the system.

## Related types

```ts
// The entity-type literal (canonical discriminator)
type EntityTypeValue = 'variable' | 'type'

// What register({ imports }) accepts
type ImportNameArg = string | {
  name: string
  alias?: string
  type: EntityTypeValue                 // 'variable' | 'type'
}
```

A bare string `'X'` is shorthand for an unaliased
`'variable'` import. The object form is required when the
import is type-only (`type: 'type'`) or when an `alias` is
supplied. `Identifier.toImport()` returns whichever shape is
appropriate based on the identifier's `entityType` and any
provided `alias`.

## See also

- [API: Import](dsl-import.md) — how imports are emitted using identifiers
- [API: Definition](dsl-definition.md) — uses identifiers for `export const NAME` / `export type NAME`
- [API: GenerateContext](generate-context.md) — `register({ imports })` accepts `ImportNameArg[]`
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) — where identifiers come from
- [`skmtc-generator` skill operational principles](../../skills/skmtc-generator/SKILL.md) — the "use Identifier.create*, not raw strings" rule
- [Glossary: Identifier, EntityType](../glossary.md)
