# Definition

> The `export const NAME = VALUE;` wrapper around a Projection's
> generated value. Bridges Projection (unit of output) and File
> (rendered output). Created automatically by Drivers; rarely
> instantiated directly.

`Definition` is the bridge layer between a Projection (which produces
*just the value* — e.g., `z.object({...})`) and the rendered file
(which needs the full `export const NAME = VALUE;` statement).
Drivers handle the wrapping; generators rarely touch `Definition`
directly.

## Source

`skmtc/deno/core/dsl/Definition.ts`

## Class

```ts
class Definition<V extends GeneratedValue = GeneratedValue> extends SnippetBase {
  identifier: Identifier
  description: string | undefined
  value: V
  noExport?: boolean

  constructor(args: {
    context: GenerateContextType
    identifier: Identifier
    value: V
    description?: string
    noExport?: boolean
  })

  override toString(): string
}
```

Extends `SnippetBase` — technically a Snippet (with `register()`
inherited), but plays a unique bridging role.

## Type parameter

`V extends GeneratedValue` — the value being wrapped. The generic
parameter preserves the type of the underlying Projection's output.
Most callers don't specify `V` explicitly; type inference handles it.

## Constructor

```ts
new Definition({
  context: GenerateContextType,
  identifier: Identifier,          // the name + entityType
  value: V,                        // the Projection's output (typically a Projection instance)
  description?: string,             // optional JSDoc description
  noExport?: boolean                // omit the `export` keyword
})
```

Created by Drivers as part of the cross-generator coordination
flow. You typically don't write `new Definition(...)` in generator
code.

## Properties

### `identifier: Identifier`

The name and entity-type marker. The `identifier.entityType` is
an `EntityType` instance; read `.type` for the discriminator
value. The declaration shape:

- `entityType.type === 'variable'` → `export const <name> = <value>;`
- `entityType.type === 'type'`     → `export type <Name> = <value>;`

(`EntityType.toString()` maps the discriminator to the rendered
TS keyword — `'variable'` becomes `const`, `'type'` stays `type` —
which is what `Definition.toString()` interpolates into the
declaration.)

Plus optional `typeName` annotation for variables (e.g.,
`export const useUser: UseQueryResult<...> = ...`).

### `description: string | undefined`

Optional JSDoc text that prefixes the declaration. When set, the
rendered output includes:

```ts
/**
 * <description text>
 */
export const NAME = VALUE;
```

When unset (default), no JSDoc is rendered.

### `value: V`

The generated content. Typically a Projection instance (whose
`toString()` produces the value text). May also be any other
`Stringable` (e.g., a string, a `CustomValue`).

When `Definition.toString()` runs, it calls `String(this.value)`
(via template-literal interpolation), which falls back to
`this.value.toString()`.

### `noExport?: boolean`

When true, the `export` keyword is omitted:

```ts
// noExport: true
const X = VALUE;

// noExport: false (default)
export const X = VALUE;
```

Useful for internal helpers that shouldn't be part of the file's
public surface. Rarely needed in practice — most generated
artifacts are exports.

## Methods

### `toString(): string`

Produces the full declaration:

```ts
override toString(): string {
  const identifier = this.identifier.typeName
    ? `${this.identifier.name}: ${this.identifier.typeName}`
    : this.identifier.name

  return withDescription(
    `${this.noExport ? '' : 'export '}${this.identifier.entityType} ${identifier} = ${this.value};\n`,
    { description: this.description }
  )
}
```

Layout:

1. Optional JSDoc block (from `description`)
2. `export` keyword (unless `noExport`)
3. Entity-type keyword (`const` or `type`)
4. Identifier name (with optional `: typeName` annotation)
5. `=`
6. The value (stringified via `String(value)`)
7. `;\n`

Output examples:

```ts
// Const, no typeName, no description
export const userBody = z.object({ name: z.string() });

// Const with typeName
export const useCreateUser: UseMutationResult<UserData, Error, CreateUserArgs> = (...) => { ... };

// Type
export type UserBody = { name: string; email: string };

// With description
/**
 * The validated request body for creating a user.
 */
export const createUserBody = z.object({ ... });

// Non-exported (rare)
const _privateHelper = (...) => { ... };
```

## How Drivers create Definitions

The Driver flow (simplified):

```ts
// In OasOperationDriver.getDefinition or similar
const cached = context.findDefinition({ name, exportPath })
if (cached && affirmDefinition(cached)) return cached

const value = new this.projection({ ... })  // construct the Projection
const definition = new Definition({
  context: this.context,
  identifier,
  value,
  noExport: this.noExport
})

context.register({
  definitions: [definition],
  destinationPath: exportPath
})

return definition
```

So a `Definition` wraps the Projection instance. When the file is
later serialized, `Definition.toString()` is called, which calls
`String(value)` — which calls `value.toString()` — which is the
Projection's `toString()`. The value text is sandwiched between
`export const NAME = ` and `;\n`.

## When to create a Definition directly

Rare. Two scenarios:

### Custom declarations outside the projection-base flow

If you have a one-off definition that doesn't fit the Projection
model (e.g., a constants object, a default-values map):

```ts
const constantsDef = new Definition({
  context: this.context,
  identifier: Identifier.createVariable('EMPTY_VALUES'),
  value: '{ ... }',                              // raw string
  description: 'Default empty values for the form fields.'
})

this.register({
  definitions: [constantsDef],
  destinationPath: this.settings.exportPath
})
```

**Trade-off**: bypasses cross-generator coordination. The Definition
exists in the file's `definitions` map, but its `generatorKey` is
the parent Projection's, so other generators can't find it via
`insertOperation`. Use only for definitions that don't need
cross-generator discoverability.

### Use a primitive value type

If wrapping a primitive (`number`, `string`, etc.) directly:

```ts
new Definition({
  context: this.context,
  identifier: Identifier.createVariable('DEFAULT_TIMEOUT', 'number'),
  value: '5000',
  description: 'Default timeout in milliseconds.'
})
```

The `value` is a string in this case (the source code for `5000`),
not the number itself.

## Common questions

### Is Definition really a Snippet?

By inheritance, yes — `Definition extends SnippetBase`. By role,
no — it's a bridging wrapper for Projections. The fact that it
extends `SnippetBase` is a technical detail; the inheritance
provides `register()` and `context` access that the bridge needs.

You won't typically interpolate a Definition into another template
(though `${someDefinition}` would work — it'd embed the full
`export const ...;` statement). Definitions are addressed by file
position, not by embedding.

### Why a generic type parameter?

`Definition<V>` preserves the type of the underlying Projection so
that callers manipulating the Definition's value get type-correct
access. In practice, most callers receive `Definition` (the default,
where `V = GeneratedValue`) and don't need the precise type. The
generic parameter helps when generator authors want strongly-typed
Definition references in their own code.

### What happens if `value` has no `toString()`?

You'd get `[object Object]` in the output — a clear sign of a bug.
In practice this doesn't happen because the values are typically
Projection instances (which inherit `toString()` requirements from
`SnippetBase`) or strings/numbers (which have natural string
conversions).

### Can I update a Definition after registering it?

No — Definitions are append-only into the file map. The
`File.definitions.has(name)` gate in `register` means first-write-
wins; subsequent registrations with the same name are silently
ignored.

If you need to vary content per generation run, do it via
enrichments or parametric inputs to the Projection's constructor,
not by mutating the Definition.

### What's the relationship between Definition and the `export const NAME` literal?

Definition is the **mechanism** that produces the literal. Without
Definition, generators would have to render `export const NAME = ...`
strings directly, manage `entityType` themselves, deal with JSDoc
formatting, etc. Definition consolidates all of that into one
class.

## Related types

```ts
// What Definition wraps
type GeneratedValue = {
  generatorKey?: GeneratorKey
  // ... structurally a Stringable
}

// Convenient alias used in Driver code
type GeneratedDefinition<V> = Definition<V>
```

## See also

- [API: Identifier](dsl-identifier.md) — what `Definition.identifier` is
- [API: GenerateContext](generate-context.md) — `register({ definitions })` accepts Definitions
- [API: SnippetBase](dsl-snippet-base.md) — what Definition extends
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) — how Definitions bridge Projections to Files
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) — how Drivers create Definitions
- [Glossary: Definition](../glossary.md)
