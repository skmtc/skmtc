# OasRef

> The class representing an OpenAPI `$ref`. Lazy resolution against a
> mutable parsed document; type-integrity checked at resolve time; a
> loop of `$ref`s names nothing.

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
  resolve(): ResolvedRef<T>
  resolveOnce(): OasRef<T> | ResolvedRef<T>
  toLoop(): OasRef<T>[] | undefined
  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ReferenceObject | ResolvedRefJsonType<T>
  toJSON(): object

  // Fields and getters
  $ref: string
  refName: RefName
  refPath: string
  refType: OasRefData['refType']
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

### `resolve(): ResolvedRef<T>`

Recursively resolves the ref to its final non-ref target. If the
target is itself a `$ref`, follows the chain. A chain of any length
resolves when it gets to a component that is not a `$ref`.

**Throws:**

- `DanglingRefError` (`Ref "<$ref>" names nothing in the document`)
  if a link in the chain names nothing in the document, or if the
  chain loops (see [`toLoop()`](#toloop-oasreft--undefined)). For a
  loop, the message says `leads into a loop of $refs (…)`, and the error's
  `loop` lists the `$ref`s of the loop. The parser removes such a ref,
  unless `client.json` `settings.system.danglingRefs` lists its kind.
  Test for it with `DanglingRefError.is(error)`.
- `Ref type mismatch for "<$ref>"` if the `$ref` names the wrong part
  of `components` for `refType`. An example is a `requestBody` ref to
  `#/components/schemas/Pet`. The parser logs a `REF_TYPE_MISMATCH`
  error and removes what holds such a ref, so a parsed document has
  none.
- `Ref type mismatch for "<$ref>"` if the resolved target has the
  wrong `oasType` (e.g., a `OasRef<'schema'>` that resolves to a
  parameter)

### `resolveOnce(): OasRef<T> | ResolvedRef<T>`

Performs one step of resolution. If the target is itself a `$ref`,
returns the next `OasRef`; if it's a non-ref item, returns the
resolved value.

Useful when you specifically want to detect ref chains. Most callers
want `resolve()` instead.

**Throws same errors as `resolve()`** for this one step. A `$ref` in a
loop names a component, so `resolveOnce()` returns the next `OasRef`
for it.

### `toLoop(): OasRef<T>[] | undefined`

The references that make the loop this ref's chain comes back to, from
the first one it comes back to. `undefined` when the chain gets to a
component that is not a `$ref`.

For `A` a `$ref` to `B`, and `B` a `$ref` to `A`, `A.toLoop()` is
`[A, B]`, and `B.toLoop()` is `[B, A]`. A property that is a `$ref` to
`A` leads into the loop but is not part of it: its `toLoop()` is
`[A, B]` too.

**Throws:** what `resolveOnce()` throws at a step of the chain.

### `toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ReferenceObject | ResolvedRefJsonType<T>`

Converts the ref back to OpenAPI JSON representation.

- If `options.resolve === false` (default): returns `{ $ref }`. For a
  component it is `#/components/<bucket>/<refName>`. For any other
  target it is the whole pointer, written one way. Core unescapes each
  segment, then writes it as RFC 6901 does, with no percent escapes:
  `#/paths/~1disks~1{diskId}/parameters/0`.
- If `options.resolve === true`: returns the resolved target's
  JSON schema, inlining the ref. Cycle protection from `resolve()`
  applies.

**Throws:** `DanglingRefError` for a `$ref` with no name
(`#/components/schemas/`) when `options.resolve` is false. Written out,
that `$ref` would name nothing, so the caller decides what to write in
its place. When `options.resolve` is true, the errors of `resolve()`.

### `toJSON(): object`

Serialization for `JSON.stringify`. Returns the same shape as
`toJsonSchema({ resolve: false })`, and throws the same errors.

## Getters

### `$ref`

The raw `$ref` string, e.g., `'#/components/schemas/User'`.

### `refName` and `refPath`

The two parts of the `$ref`'s pointer. `refName` is the last segment,
unescaped (`%20` is a space, `~1` is `/`, `~0` is `~`). `refPath` is the
pointer before it, with no percent escapes.

| `$ref` | `refPath` | `refName` |
| --- | --- | --- |
| `#/components/schemas/User` | `#/components/schemas` | `User` |
| `#/components/parameters/UserId` | `#/components/parameters` | `UserId` |
| `#/components/schemas/__sharedInput/$defs/schema0` | `#/components/schemas/__sharedInput/$defs` | `schema0` |
| `#/paths/~1disks~1%7BdiskId%7D/parameters/0` | `#/paths/~1disks~1{diskId}/parameters` | `0` |
| `#/components/schemas/` | `#/components/schemas` | empty: the `$ref` names nothing |

A `refPath` that is a bucket names a component, which resolves in
`components`. Any other `refPath` points into the document's content;
see [Where a ref points](../../concepts/refs-and-resolution.md#where-a-ref-points-refname-and-refpath).
A `$ref` that does not start with `#` is remote: it points outside the
document. Its `refPath` keeps the file, so `other.yml#/components/schemas/A`
has `refPath` `other.yml#/components/schemas` and `refName` `A`, and it
names nothing here. Core does not fetch. Bundle the files into one
document first; see
[External `$ref`s](../settings/source-resolution.md#external-refs-in-oas-specs).

The two fields make an `OasRef<'schema'>` a `RefParts`, the shape the
model API takes. Pass the ref as it is: `insertModel(Peer, ref)`,
`resolveSchemaRefOnce(ref)`, `toModelRef({ …, ref })`.

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
// core/parse/v3-1/ref/toRefV31.ts
const oasRef = context.withStackTrail(stackTrail, () =>
  new OasRef({ ...siblings, refType, $ref }, context)  // ← holds the mutable document
)

context.registerOasRef(stackTrail.clone(), oasRef)

return oasRef
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
    const { refName, refPath } = s
    console.log(`Found ref to ${refName} in ${refPath}`)
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

### Can I find a loop of `$ref`s before `resolve()` throws?

Call `toLoop()`. It is `undefined` when the chain gets to a component:

```ts
const loop = ref.toLoop()

if (loop !== undefined) {
  // `ref` names nothing: `loop` holds the references of the loop
}
```

The parser keeps a loop only when `system.danglingRefs` lists its
kind, so a generator meets one only then.

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
schemas before passing to Skmtc.

## Cross-references

- [Refs and resolution concept](../../concepts/refs-and-resolution.md) — the mental model
- [OAS schema variants](oas-schema-variants.md) — the union `OasRef` resolves into
- [Error codes](../error-codes.md) — `DANGLING_REF`, `REF_TYPE_MISMATCH`
- [API: ParseContext](parse-context.md) — where `OasRef`s get constructed during parse
