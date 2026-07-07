# OasRef

> The class representing an OpenAPI `$ref`. Lazy resolution against a
> mutable parsed document; type-integrity checked at resolve time;
> cycle-protected by a depth counter.

## Source

`skmtc/deno/core/oas/ref/Ref.ts`

## Class signature

```ts
class OasRef<T extends OasRefData['refType']> {
  oasType: 'ref'
  type: 'ref'

  constructor(fields: RefFields<T>, document: SkmtcParsedDocument)

  // Methods
  isRef(): this is OasRef<T>
  resolve(lookupsPerformed?: number): ResolvedRef<T>
  resolveOnce(): OasRef<T> | ResolvedRef<T>
  toRefName(): RefName
  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ReferenceObject | ResolvedRefJsonType<T>
  toJSON(): object

  // Getters
  get $ref(): string
  get refType(): OasRefData['refType']
  get document(): SkmtcParsedDocument
}
```

## Type parameter

`T extends OasRefData['refType']` — the *expected* category of the
ref target. One of:

- `'schema'` (most common)
- `'requestBody'`
- `'parameter'`
- `'response'`
- `'example'`
- `'header'`
- `'securityScheme'`

Different `refType`s are distinct types. A function declaring
`OasRef<'schema'>` won't accept `OasRef<'parameter'>` at compile
time.

## Constants

```ts
const MAX_LOOKUPS = 10
```

The maximum depth `resolve()` will chase through chained `$ref`s
before throwing `Max lookups reached`. Catches cycles and
pathologically deep ref chains.

## Constructor

```ts
new OasRef(
  { refType, $ref }: RefFields<T>,
  document: SkmtcParsedDocument
)
```

Constructed during parse by `toRefV31`. The `document` argument is
the **in-progress parsed document**, held by reference. Mutations to
the document after construction are visible through this reference —
this is what makes lazy resolution work for forward `$ref`s.

You should not need to construct `OasRef` directly outside the parse
layer.

## Properties

### `oasType: 'ref'`

The runtime tag. Lets discriminated-union narrowing distinguish
`OasRef` from `OasObject`, `OasParameter`, etc. — all of which have
their own `oasType` literal.

### `type: 'ref'`

Duplicate of `oasType`. Kept for compatibility with the
`OasSchema` union (which uses `type` as its discriminator).

### `#fields` (private)

`{ refType: T, $ref: string }` — the ref data. Accessed via the
public getters `refType` and `$ref`.

### `#document` (private)

A reference to the parsed document for resolution lookups. Accessed
via the public getter `document`.

## Methods

### `isRef(): this is OasRef<T>`

Type guard. Always returns `true`. Mirrored on every schema variant
class (which return `false`). Used by callers handling
`OasSchema | OasRef<'schema'>` parameters:

```ts
function handle(value: OasSchema | OasRef<'schema'>) {
  if (value.isRef()) {
    // value is narrowed to OasRef<'schema'>
    const resolved = value.resolve()
  } else {
    // value is narrowed to OasSchema
    if (value.type === 'object') { ... }
  }
}
```

### `resolve(lookupsPerformed?: number): ResolvedRef<T>`

Recursively resolves the ref to its final non-ref target. If the
target is itself a `$ref`, follows the chain.

**Throws:**

- `Max lookups reached` if the chain depth exceeds `MAX_LOOKUPS` (10)
- `Ref "<$ref>" not found` if any link in the chain is missing
- `Ref type mismatch for "<$ref>"` if the resolved target has the
  wrong `oasType` (e.g., a `OasRef<'schema'>` that resolves to a
  parameter)

`lookupsPerformed` is the internal recursion counter; callers should
omit it.

### `resolveOnce(): OasRef<T> | ResolvedRef<T>`

Performs one step of resolution. If the target is itself a `$ref`,
returns the next `OasRef`; if it's a non-ref item, returns the
resolved value.

Useful when you specifically want to detect ref chains. Most callers
want `resolve()` instead.

**Throws same errors as `resolve()`** except `Max lookups reached`
(which only applies to chained resolution).

### `toRefName(): RefName`

Extracts the bare name from the `$ref` string. For
`#/components/schemas/User`, returns `User`. For
`#/components/parameters/UserId`, returns `UserId`.

The `RefName` brand type narrows the return for type-safe lookup
into component buckets.

### `toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ReferenceObject | ResolvedRefJsonType<T>`

Converts the ref back to OpenAPI JSON representation.

- If `options.resolve === false` (default): returns
  `{ $ref: '#/components/<bucket>/<refName>' }` — the original
  reference shape.
- If `options.resolve === true`: returns the resolved target's
  JSON schema, inlining the ref. Cycle protection from `resolve()`
  applies.

### `toJSON(): object`

Serialization for `JSON.stringify`. Returns the same shape as
`toJsonSchema({ resolve: false })`.

## Getters

### `$ref`

The raw `$ref` string, e.g., `'#/components/schemas/User'`.

### `refType`

The expected category of the target. The type-parameter value `T`.

### `document`

The discriminated `SkmtcParsedDocument` this ref resolves through.
For OAS, contains an `OasDocument`. For GraphQL, contains a
`GqlDocument` with a `registry` for schema lookup.

## Type-integrity check

`resolveOnce()` performs a check after lookup:

```ts
if (resolved.isRef()) {
  if (resolved.refType !== this.refType) {
    throw new Error(
      `Ref type mismatch for "${this.$ref}". Expected "${this.refType}" but got "${resolved.refType}"`
    )
  }
} else {
  if (resolved.oasType !== this.refType) {
    throw new Error(
      `Type mismatch for "${this.$ref}". Expected "${this.refType}" but got "${resolved.oasType}"`
    )
  }
}
```

This catches OAS documents where a `$ref` from a position expecting
(say) a schema actually points at a parameter — a wrong-bucket
reference. The check is enforced at resolution time, not at
construction.

## Forward-reference handling

The trick that lets `OasRef` work without two-pass parsing:

```ts
// core/oas/ref/toRefV31.ts:26-34
context.registerRef(stackTrail.clone(), $ref)

return new OasRef(
  { refType, $ref },
  context.parsedDocument  // ← reference to mutable document
)
```

`context.parsedDocument` returns the **same mutable instance** that
the parser is filling in. By the time anyone calls
`someRef.resolve()`, the document is fully populated even if the
ref was encountered before its target during the walk.

See [refs-and-resolution concept doc](../../concepts/refs-and-resolution.md#the-forward-ref-problem).

## Related types

```ts
// Generic type representing a resolved ref
type ResolvedRef<T extends OasRefData['refType']> =
  Extract<OasComponentType, { oasType: T }>

// Union of all resolvable types
type OasComponentType =
  | OasSchema       // union: OasObject | OasArray | ...
  | OasResponse
  | OasParameter
  | OasExample
  | OasRequestBody
  | OasHeader
  | OasSecurityScheme

// Ref field data
type RefFields<T extends OasRefData['refType']> = {
  refType: T
  $ref: string
}

// Options for JSON conversion
type ToJsonSchemaOptions = {
  resolve: boolean
}
```

## Examples

### Basic resolution

```ts fragment
import { OasRef } from '@skmtc/core'

// Constructed during parse; you typically receive one
const userRef = new OasRef<'schema'>({
  refType: 'schema',
  $ref: '#/components/schemas/User'
}, document)

// Resolve to the underlying schema
const userSchema = userRef.resolve()
console.log(userSchema.type)  // 'object'
```

### Type-guarded handling

```ts
function processSchemaOrRef(s: OasSchema | OasRef<'schema'>) {
  if (s.isRef()) {
    const refName = s.toRefName()
    console.log(`Found ref to ${refName}`)
    const resolved = s.resolve()
    return process(resolved)
  }

  // s is OasSchema here — narrowed via discriminated union
  return process(s)
}
```

### Chained refs

```ts
// $ref: '#/components/schemas/AliasToUser'
// where AliasToUser is { $ref: '#/components/schemas/User' }
const chained = parameter.toSchema()

const oneStep = chained.resolveOnce()
// oneStep is still an OasRef (points at User)

const final = chained.resolve()
// final is the User schema (chased through both hops)
```

### One-hop with retry

```ts
function describeChain(ref: OasRef<'schema'>): string[] {
  const chain: string[] = [ref.$ref]
  let current = ref.resolveOnce()
  while (current.isRef()) {
    chain.push(current.$ref)
    current = current.resolveOnce()
  }
  chain.push(`(${current.oasType})`)
  return chain
}
```

## Common questions

### Can I detect cycles before they throw `Max lookups reached`?

Walk the chain with `resolveOnce()` and a `Set<string>` of seen
`$ref` strings:

```ts
function detectCycle(ref: OasRef<'schema'>): boolean {
  const seen = new Set<string>([ref.$ref])
  let current = ref.resolveOnce()
  while (current.isRef()) {
    if (seen.has(current.$ref)) return true
    seen.add(current.$ref)
    current = current.resolveOnce()
  }
  return false
}
```

### What's the difference between `oasType` and `refType`?

- `refType` is what the `OasRef` *expects* (set at construction).
- `oasType` is what the *resolved value* actually is.

The integrity check compares them. Mismatch = wrong-bucket
reference.

### Is `OasRef` covariant in its type parameter?

No — `OasRef<'schema'>` and `OasRef<'parameter'>` are distinct
types. The type parameter is used as a discriminator and to narrow
return types. This is what enforces compile-time correctness for the
type-integrity check.

### Can I construct an `OasRef` outside the parse layer?

You can, but you'd need a `SkmtcParsedDocument` to resolve against.
In practice, generators receive `OasRef`s from the parsed model —
they don't construct new ones.

### What about external `$ref`s (multi-file)?

Not supported. The `$ref` is resolved within
`context.parsedDocument`, which is single-document. Bundle multi-file
schemas before passing to SKMTC.

## Cross-references

- [Refs and resolution concept](../../concepts/refs-and-resolution.md) — the mental model
- [OAS schema variants](oas-schema-variants.md) — the union `OasRef` resolves into
- [Error codes](../error-codes.md) — `Max lookups reached`, `Ref not found`, type mismatch
- [API: ParseContext](parse-context.md) — where `OasRef`s get constructed during parse
