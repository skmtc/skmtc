# OAS schema variants

> The union type `OasSchema` and its eight constituent classes:
> `OasObject`, `OasArray`, `OasUnion`, `OasString`, `OasInteger`,
> `OasNumber`, `OasBoolean`, `OasUnknown`. Sibling classes with a
> shared duck-typed interface — **not a class hierarchy**.

`OasSchema` is one of the most common parameter types in SKMTC
generator code. Its shape — a discriminated union of sibling
classes, not a base class with subclasses — is intentional and
load-bearing for the type-narrowing behavior generators depend on.

## Source

`skmtc/deno/core/oas/schema/Schema.ts` (the union type)
`skmtc/deno/core/oas/{object,array,union,string,integer,number,boolean,unknown}/<Name>.ts` (variants)

## The union type

```ts
type OasSchema =
  | OasArray
  | OasBoolean
  | OasInteger
  | OasNumber
  | OasObject
  | OasString
  | OasUnknown
  | OasUnion
```

Eight independent classes. Each is a top-level class (no shared
parent). They share a structural interface via duck typing, not via
inheritance.

## Why not a class hierarchy?

A common LLM intuition: "These should all extend a `BaseSchema`
class." SKMTC's design rejects this for specific reasons:

1. **TypeScript narrowing works on discriminated unions.** With a
   union, `if (schema.type === 'object')` narrows `schema` to
   `OasObject` automatically. A base class hierarchy would force
   runtime type checks (`instanceof`) or downcasts (`as
   OasObject`).

2. **Each variant has variant-specific methods that don't
   generalize.** `OasObject.addProperty()`, `OasArray.items` (a
   property unique to arrays), `OasUnion.variants` — there's no
   sensible base interface that captures all of them.

3. **Sibling-classes-plus-duck-typed-common-interface is what TS
   does well.** The pattern matches how
   `{ type: 'object'; ... } | { type: 'array'; ... }` discriminated
   unions work elsewhere in TypeScript.

The [skmtc-generator skill's operational principles](../../skills/skmtc-generator/SKILL.md)
explicitly forbids adding a `BaseSchema` class. Don't "clean up"
this union into a hierarchy.

## Shared interface across variants

Every variant independently implements:

```ts
class OasXxx {
  oasType: 'schema' = 'schema'        // discriminator at the OasComponentType level
  type: '...'                          // discriminator at the OasSchema level

  isRef(): this is OasRef<'schema'>    // type guard, always returns false
  resolve(): this                      // resolves to itself (no-op for non-refs)
  resolveOnce(): this                  // one-step resolve, also no-op
}
```

And `OasRef<'schema'>` is a *sibling* (not a parent) that
implements:

```ts
class OasRef<T> {
  oasType: 'ref' = 'ref'
  type: 'ref' = 'ref'

  isRef(): this is OasRef<T>           // returns true
  resolve(): ResolvedRef<T>            // chases the chain
  resolveOnce(): OasRef<T> | ResolvedRef<T>
}
```

The duck-typed `isRef()` is the load-bearing type guard. A
parameter typed `OasSchema | OasRef<'schema'>` can be narrowed by
calling `.isRef()`:

```ts
function handle(value: OasSchema | OasRef<'schema'>) {
  if (value.isRef()) {
    // value is narrowed to OasRef<'schema'>
    const resolved = value.resolve()
    // resolved is OasSchema (the variant union)
  } else {
    // value is narrowed to OasSchema
    if (value.type === 'object') {
      // value is now OasObject
    }
  }
}
```

## Variants

### `OasObject` — `type: 'object'`

```ts
class OasObject {
  oasType: 'schema'
  type: 'object'
  properties?: Record<string, OasSchema | OasRef<'schema'>>
  required?: string[]
  nullable?: boolean
  description?: string
  // ... other JSON Schema object fields
  extensionFields?: Record<string, unknown>

  isRef(): false
  resolve(): this
  resolveOnce(): this
  addProperty(args: { name, schema, required }): OasObject  // builder; returns mutated this
  // ... methods specific to objects
}
```

The `addProperty` builder method enables the
`operation.toParametersObject().addProperty(...)` pattern that form
generators use to augment OAS parameters with form-specific fields.

### `OasArray` — `type: 'array'`

```ts
class OasArray {
  oasType: 'schema'
  type: 'array'
  items: OasSchema | OasRef<'schema'>
  minItems?: number
  maxItems?: number
  // ... other array fields

  isRef(): false
  resolve(): this
}
```

### `OasUnion` — `type: 'union'`

The parsed result of `oneOf` and `anyOf` schemas. The parser maps
these to a single internal `OasUnion` representation.

```ts
class OasUnion {
  oasType: 'schema'
  type: 'union'
  variants: (OasSchema | OasRef<'schema'>)[]
  discriminator?: OasDiscriminator     // from OAS discriminator object
  // ... other fields
}
```

`oneOf` vs `anyOf` distinction is preserved via the underlying parse
metadata; the union representation is similar for both.

### `OasString` — `type: 'string'`

```ts
class OasString {
  oasType: 'schema'
  type: 'string'
  enums?: (string | number | boolean | null)[]
  format?: string              // 'date', 'date-time', 'email', 'uri', etc.
  pattern?: string
  minLength?: number
  maxLength?: number
}
```

### `OasInteger` and `OasNumber`

Distinct types — integers are not just specially-formatted numbers
in OAS:

```ts
class OasInteger {
  oasType: 'schema'
  type: 'integer'
  minimum?: number
  maximum?: number
  enums?: (number | null)[]
  format?: 'int32' | 'int64'
}

class OasNumber {
  oasType: 'schema'
  type: 'number'
  minimum?: number
  maximum?: number
  enums?: (number | null)[]
  format?: 'float' | 'double'
}
```

The split exists because TypeScript and most validation libraries
treat them differently (e.g., Zod has `z.number().int()` vs
`z.number()`).

### `OasBoolean` — `type: 'boolean'`

```ts
class OasBoolean {
  oasType: 'schema'
  type: 'boolean'
  default?: boolean
}
```

### `OasUnknown` — `type: 'unknown'`

The fallback variant when the parser can't infer a more specific
type. Carries the original OAS schema object for inspection:

```ts
class OasUnknown {
  oasType: 'schema'
  type: 'unknown'
  value: OpenAPIV3.SchemaObject     // the original schema
}
```

When a generator encounters `OasUnknown`, the practical move is to
either:

- Skip it (the operation/field has incomplete typing)
- Emit a generic fallback (e.g., `unknown` in TS, `z.unknown()` in
  Zod)

## Discriminator pattern

The recommended way to handle `OasSchema` in a generator:

```ts
function generate(schema: OasSchema | OasRef<'schema'>): string {
  if (schema.isRef()) {
    return /* handle ref */
  }

  switch (schema.type) {
    case 'object':  return generateObject(schema)    // schema is OasObject
    case 'array':   return generateArray(schema)     // schema is OasArray
    case 'string':  return generateString(schema)    // etc.
    case 'integer': return generateInteger(schema)
    case 'number':  return generateNumber(schema)
    case 'boolean': return generateBoolean(schema)
    case 'union':   return generateUnion(schema)
    case 'unknown': return generateUnknown(schema)
    default: {
      const _exhaustive: never = schema
      throw new Error(`Unhandled schema type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}
```

The `_exhaustive: never` default ensures the compiler catches missed
variants if new ones are added.

## Examples

### Type-narrowed access to variant-specific fields

```ts
function describe(schema: OasSchema): string {
  switch (schema.type) {
    case 'object':
      return `object with ${Object.keys(schema.properties ?? {}).length} properties`
    case 'array':
      return `array of ${describe(schema.items.resolve())}`
    case 'string':
      return schema.format ? `string (${schema.format})` : 'string'
    case 'union':
      return `union of ${schema.variants.length}`
    // ...
  }
}
```

`schema.properties` is only accessible inside the `case 'object'`
branch — TypeScript narrows the union to `OasObject` based on the
discriminator.

### Common parameter pattern

Most generator-facing API parameters are typed as
`OasSchema | OasRef<'schema'>` because parsed OAS schemas may be
either inline or refs:

```ts
function process(s: OasSchema | OasRef<'schema'>) {
  if (s.isRef()) {
    return process(s.resolve())  // recursively process the resolved schema
  }
  // s is now narrowed to OasSchema
  // ...
}
```

### Mixing variants in cross-generator coordination

When a generator calls `insertNormalizedModel(SomeProjection, {
schema, fallbackName })`, the schema parameter accepts either
`OasSchema | OasRef<'schema'> | OasVoid`. The Driver branches:

- `schema.isRef()` → routes through model cache (strict integrity)
- Otherwise → uses `fallbackName` (loose integrity)

So a generator doesn't need to handle ref-vs-inline explicitly when
delegating cross-generator work — `insertNormalizedModel` handles
both.

## Common questions

### Why not add a `BaseSchema` to share methods?

The methods that look shared (`isRef`, `resolve`, `resolveOnce`)
have variant-specific implementations:

- On schema variants: `isRef()` returns `false`, `resolve()` returns
  `this`
- On `OasRef`: `isRef()` returns `true`, `resolve()` chases the chain

A base class would either need to be abstract (forcing override in
every variant) or have implementations that get overridden (the
base methods would be dead code). The duck-typed approach skips
the dance.

The deeper reason: TypeScript's structural discriminated unions
narrow much better than nominal inheritance hierarchies. The
codebase leans into TypeScript's strengths.

### What if I need a new schema variant?

You'd add a new class with its own `type` literal, then add it to
the `OasSchema` union. The parser would also need a branch in
`toSchemaV3` to dispatch to it.

This is a substantive change — touching every generator's
`switch (schema.type)` to add the new case. In practice, the eight
variants cover JSON Schema's primitives plus the SKMTC-specific
unions/unknown. New variants would be rare.

### How does `OasUnion` represent `oneOf` vs `anyOf`?

Both map to `OasUnion` with the same shape. The distinction is
sometimes preserved via metadata on the parent operation/parameter,
but generators usually treat them the same — emit a TS union type
or Zod discriminated union.

The OAS spec's intended semantic distinction (`oneOf` = exactly
one, `anyOf` = at least one) rarely matters for code generation,
where both become `A | B` or `z.union([A, B])`.

### Why is `OasUnknown` a separate variant rather than `null`?

Generators need to know "this schema couldn't be resolved to a
specific type" vs "this property doesn't have a schema." Conflating
them via `null` would lose that signal. `OasUnknown` is "we know
there's a schema, we just don't know its shape" — a meaningful
condition to handle (emit `unknown`, `any`, or `z.unknown()`).

### Where does `OasRef<'schema'>` fit?

It's not in the `OasSchema` union. The common parameter type for
"schema-or-ref-to-schema" is `OasSchema | OasRef<'schema'>` (also
sometimes typed as `OasVoid` for empty bodies, giving
`OasSchema | OasRef<'schema'> | OasVoid`).

The split lets generators handle refs explicitly without forcing
them to handle the resolve step on every access. See
[OasRef reference](oas-ref.md).

## Related types

```ts
// The union
type OasSchema =
  | OasArray | OasBoolean | OasInteger | OasNumber
  | OasObject | OasString | OasUnknown | OasUnion

// Used in generator-facing signatures
type OasSchemaOrRef = OasSchema | OasRef<'schema'>

// Used for request bodies (may be absent)
type OasSchemaOrRefOrVoid = OasSchema | OasRef<'schema'> | OasVoid

// The broader union including non-schema components
type OasComponentType =
  | OasSchema
  | OasResponse
  | OasParameter
  | OasExample
  | OasRequestBody
  | OasHeader
  | OasSecurityScheme
```

## See also

- [API: OasRef](oas-ref.md) — the sibling class for references
- [API: OasDocument model](oas-document-model.md) — broader OAS model
- [Refs and resolution concept](../../concepts/refs-and-resolution.md) — how refs interact with schemas
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) — what generators do with schemas
- [`skmtc-generator` skill anti-patterns](../../skills/skmtc-generator/SKILL.md) — the "no BaseSchema" rule
- [Glossary: OasSchema, OasRef, oasType](../glossary.md)
