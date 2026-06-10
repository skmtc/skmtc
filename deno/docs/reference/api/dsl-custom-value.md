# CustomValue

> The escape-hatch Snippet that wraps an arbitrary `Stringable` —
> for code fragments that don't fit any OAS-derived schema variant.
> Renders its wrapped value verbatim.

For when to reach for `CustomValue` vs a structured DSL primitive,
see [stringable-composition.md](../../concepts/stringable-composition.md#roots-and-wrappers).

## Source

`skmtc/deno/core/dsl/CustomValue.ts`

## Class

```ts
class CustomValue extends SnippetBase {
  readonly type: 'custom'
  value: Stringable

  constructor(args: {
    context: GenerateContextType
    value: Stringable
    generatorKey?: GeneratorKey
  })

  isRef(): false
  resolve(): this
  toString(): string
}

const isCustomValue: (value: unknown) => value is CustomValue
```

## Properties

### `type: 'custom'`

Constant discriminator. Lets `CustomValue` participate in the
`SchemaType` discriminated union as the `type: 'custom'` branch of
[`schemaToValueFn`](../glossary.md#schematovaluefn). Most stock
generators handle that branch as `custom => custom` — pass through
unchanged.

### `value: Stringable`

The wrapped fragment. Any `Stringable` is accepted: a plain string,
another Snippet, a `List`, an `Identifier`. The wrapper adds no
structure — `toString()` returns the value rendered as a string.

## Methods

### `isRef(): false`

Always returns `false`. Lets `CustomValue` coexist with `OasSchema`
variants and `OasRef` in positions that accept "schema or ref" —
the type-narrowing `if (x.isRef())` branch never picks
`CustomValue`.

### `resolve(): this`

Always returns `this`. `CustomValue` is already a resolved leaf, so
the resolution machinery (which exists for `OasRef`) is a no-op.

### `toString(): string`

Returns the wrapped value's `toString()` output. No wrapping, no
modifiers applied — the fragment renders exactly as it was
provided.

## `isCustomValue(value)`

Type guard:

```ts
function processSchemaValue(v: SchemaType) {
  if (isCustomValue(v)) {
    // v is CustomValue
  }
}
```

## Examples

### Injecting a TypeScript utility type

```ts
const allRequired = new CustomValue({
  context,
  value: `Required<${userBodyIdentifier}>`
})

return new TsDefinition({
  context,
  identifier: createType('AllRequiredUserBody'),
  value: allRequired
})
```

The wrapped fragment uses an interpolated `Identifier` whose own
`toString()` renders the name. `CustomValue.toString()` returns
the fully expanded string.

### Inserting via `schemaToValueFn` dispatch

A generator with a pre-built fragment that should bypass the
schema-variant dispatch:

```ts
const custom = new CustomValue({
  context,
  value: 'z.unknown()'
})

context.insertNormalizedModel(ZodProjection, {
  schema: custom,
  fallbackName: 'OpaqueBlob',
  destinationPath: settings.exportPath
})
```

The `ZodProjection`'s dispatch sees `schema.type === 'custom'`,
matches the `custom => custom` branch, and registers the
fragment-as-Definition under `OpaqueBlob`.

## When to use vs alternatives

| Need | Reach for |
|---|---|
| A fragment derivable from an OAS schema | The model generator's normal dispatch (no `CustomValue` needed) |
| A reusable component fragment with structured properties | A bespoke `Snippet` subclass with `toString()` over typed fields |
| A one-off interpolated string with no schema correspondence | `CustomValue` |
| A wrapper type expression (`Partial<T>`, `Required<T>`, etc.) | `CustomValue` interpolating an `Identifier` for `T` |
| Multiple call sites needing the same wrapped fragment | Consider a small Snippet class instead — `CustomValue` keeps no structure |

`CustomValue` is the escape hatch, not the default. Reach for a
typed Snippet first; fall back to `CustomValue` when the fragment
has no structure worth modeling.

## See also

- [Concept: composing output with Stringable](../../concepts/stringable-composition.md)
- [Concept: the type system](../../concepts/the-type-system.md#customvalue--the-escape-hatch-in-the-union)
- [API: SnippetBase](dsl-snippet-base.md) — the abstract root
- [API: Definition](dsl-definition.md) — the file-scope wrapper
  that often interpolates `CustomValue` as its `value`
- [Glossary: CustomValue](../glossary.md#customvalue)
