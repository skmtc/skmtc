# Refs and resolution

> How OpenAPI `$ref`s are parsed, tracked, and resolved through the
> Skmtc pipeline: `OasRef` as a sibling-class to schema variants,
> lazy resolution with cycle protection, forward-reference handling
> via shared mutable document, and cascade pruning when refs fail.

OAS documents express reuse through `$ref`. Skmtc's job is to make
refs first-class without forcing them to resolve at parse time —
which would require either two passes or strict topological ordering.

The mechanism: `OasRef` is a class with a live reference to the
in-progress parsed document. Resolution is lazy and happens at
access time, by which point the document is fully populated.

## The one-line definition

When the parser encounters `$ref: '#/components/schemas/User'`, it
constructs an `OasRef` carrying just the `$ref` string and a reference
to `context.parsedDocument`. The document is *mutable* and being
built during the walk. By the time anyone calls `.resolve()` on the
ref, the document has been populated, so the lookup succeeds.

## OasRef as a sibling class

A common LLM intuition: "Refs are wrappers around schemas; they
should be a subclass of schema."

Skmtc's design is different. `OasSchema` is a discriminated union:

```ts
type OasSchema =
  | OasObject
  | OasArray
  | OasString
  | OasInteger
  | OasNumber
  | OasBoolean
  | OasUnion
  | OasUnknown
```

`OasRef` is *not* in this union. It's a separate class. Generators
that handle "either a schema or a ref to one" use the union
`OasSchema | OasRef<'schema'>`.

This split has a meaningful consequence: the type system *requires*
generator authors to call `.isRef()` before accessing schema-specific
properties:

```ts
function generate(schemaOrRef: OasSchema | OasRef<'schema'>) {
  if (schemaOrRef.isRef()) {
    // schemaOrRef is OasRef<'schema'>; .type, .properties not accessible
    const resolved = schemaOrRef.resolve()
    // resolved is OasSchema
  } else {
    // schemaOrRef is OasSchema; can access .type directly
    if (schemaOrRef.type === 'object') {
      // ...
    }
  }
}
```

Every variant — `OasObject`, `OasArray`, `OasString`, … and `OasRef`
— independently implements `.isRef()`:

- On `OasRef`: returns `true`
- On every schema variant: returns `false`

So `.isRef()` is the type-discriminating guard. The type system
threads through the narrowing automatically.

## Where a ref points: `refName` and `refPath`

A `$ref` is a JSON pointer, and it can point anywhere in the document,
not only at a component. `OasRef` splits it in two: `refName`, the last
segment unescaped, and `refPath`, the pointer before it, as written.

| `$ref` | `refPath` | `refName` |
| --- | --- | --- |
| `#/components/schemas/Pet` | `#/components/schemas` | `Pet` |
| `#/components/schemas/__sharedInput/$defs/schema0` | `#/components/schemas/__sharedInput/$defs` | `schema0` |
| `#/components/schemas/ChatResponse/properties/result` | `#/components/schemas/ChatResponse/properties` | `result` |
| `#/paths/~1accounts/get/responses/200/content/application~1json/schema` | `#/paths/~1accounts/get/responses/200/content/application~1json` | `schema` |
| `#/components/parameters/Limit` | `#/components/parameters` | `Limit` |

A ref whose `refPath` is a bucket (`#/components/schemas`,
`#/components/parameters`, …) names a component, and resolves in
`components`. Any other ref points into the document's content. The
parser parses its target once, at the target's own position. It uses
the parser that components of that kind use, and keeps the target on the
document under the whole pointer. A target that refers back to itself
stays a lazy ref, as a recursive component does. A target that fails to
parse removes what refers to it, and the `INVALID_DEPENDENCY_REF` names
the target's error.

The engine keys a component's model by `refName` alone, as it always
has. Generator keys, enrichments and manifests from earlier runs stay
the same. The engine keys any other target by its whole pointer. In
`client.json`, the enrichments of such a target go under that pointer
(`"#/components/schemas/ChatResponse/properties/result": { "main": … }`).

The model generator's identity statics receive both `refName` and
`refPath` (`refPath` is absent for a component). The name is the
generator's: `refName` alone repeats across positions, as two refs to
`…/properties/disk` under different schemas do. Pass a ref's `refPath`
everywhere you pass its `refName`: to `insertModel` (`{ refPath }`), to
`toModelRef`, and to `resolveSchemaRefOnce({ refName, refPath })` in the
projection. `resolveSchemaRefOnce` requires the `refPath` key, so the
compiler finds a call that drops it.

## The forward-ref problem

OAS documents can have refs that point at schemas defined later in
the same file:

```yaml
components:
  schemas:
    Post:
      type: object
      properties:
        author: { $ref: '#/components/schemas/User' }  # ← User defined later
    User:
      type: object
      properties:
        name: { type: string }
```

A naive parser would need either:

1. **Two passes**: parse all schemas first, then resolve refs. Adds
   complexity.

2. **Strict ordering**: require schemas to be defined before
   references. Constrains the input.

3. **Lazy resolution**: store the ref, resolve when needed. Requires
   the resolution target to be accessible at resolution time.

Skmtc takes path 3. The trick: `OasRef` is constructed during the
walk with a reference to `context.parsedDocument`, which is the
*in-progress* parsed document. The document is **mutated as the walk
progresses** — when `User` finishes parsing, it's added to
`oasDocument.components.schemas['User']`. By the time any consumer
calls `someRef.resolve()`, the document is fully populated.

```ts
// core/parse/v3-{0,1,2}/ref/toRefV31.ts
const oasRef = context.withStackTrail(stackTrail, () =>
  new OasRef({ refType, $ref, nullable }, context)
)

context.registerOasRef(stackTrail.clone(), oasRef)

return oasRef
```

The `OasRef` constructor stores `context.parsedDocument`, so the
instance holds a live reference to the parsed document.
Mutation of the document by later parser code is visible through
this reference.

This is the **empty-instance-issued-up-front** pattern: an empty
`OasDocument` is constructed at the start of parse, refs capture a
reference to that wrapper, the document is mutated in place at end
of parse, and the refs now resolve through the populated fields.
The pattern is applied symmetrically to `GqlDocument` for GraphQL
inputs. Together they are what makes lazy resolution work without
requiring two parse passes or strict topological ordering of
components.

See [error-handling-philosophy.md](../explanation/error-handling-philosophy.md#1-empty-parsed-document-issued-at-construction-mutated-in-place)
for the symmetric `GqlDocument` application and the related
implementation choices.

## resolve() vs resolveOnce()

`OasRef` exposes two resolution methods:

- **`resolveOnce()`** — does one lookup. If the target is itself a
  `$ref` (a ref to a ref), returns the next `OasRef`. Useful when you
  want to see the immediate target.

- **`resolve()`** — recursively chases until reaching a non-ref. If
  there are 5 layers of `$ref → $ref → $ref → $ref → schema`, returns
  the schema at depth 5. Throws `DanglingRefError` if the chain loops
  (see [Loops of `$ref`s](#loops-of-refs)).

Most consumers want `resolve()` — they don't care whether the path
is direct or indirect, they want the underlying schema.

```ts
// Typical usage in a generator
const schema = bodyRef.resolve()  // unwraps any ref chain
if (schema.type === 'object') {
  // work with the resolved object schema
}
```

## Keywords next to a reference

A document can write keywords next to a reference, for example
`nullable`, `description` or `maxLength`. The parser for each OpenAPI
version follows that version's rules:

- **OpenAPI 3.0** ignores keywords written directly beside `$ref`, as
  its spec says. The parser reports each one as `UNEXPECTED_PROPERTY`.
  To add keywords to a reference, a 3.0 document wraps it in a
  one-member `allOf`: `{ allOf: [{ $ref }], nullable: true }`.
- **OpenAPI 3.1 and 3.2** apply keywords beside `$ref` together with
  the target, as JSON Schema 2020-12 does. The parser reads
  `{ $ref, maxLength: 3 }` the same as the `allOf` form.

In every version, the keywords stay on the `OasRef`, and the
referenced model does not change. `resolve()` returns the schema at
the site. When the keywords of the reference change the target, the
result is a copy of the target with the keywords applied. When they
change nothing, the result is the shared model. A keyword changes
nothing in three cases. The type of the target does not take it, the
target already has the flag, or the target has the same value.

Other code can get the same object from `resolve()`, so do not change
it. The shared model is what every reference to it sees. A reference
builds its copy one time, keeps it, and returns it on every call.

A generator renders a reference in one of two ways. It renders the
reference by name and applies the keywords of the reference. Or it
renders the resolved schema and uses only the keywords of that
schema. It never does both, or a keyword such as `nullable` applies
twice. Two sites can point at one model and still resolve to two
different copies. So compare reference names to find out whether two
sites point at one model.

## Type integrity check on resolution

`resolveOnce()` performs a type-integrity check. The check ensures
the resolved value is of the *expected* `refType`:

```ts
resolveOnce(): OasRef<T> | ResolvedRef<T> {
  if (this.refName === '') {
    throw new DanglingRefError(this.$ref)
  }

  const resolved = this.#resolveOasOnce(...) ?? this.#resolveGqlOnce(...)

  if (!resolved) {
    throw new DanglingRefError(this.$ref)
  }

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

  return resolved as OasRef<T> | ResolvedRef<T>
}
```

So a `OasRef<'schema'>` that resolves to a parameter (different
`refType`) throws at resolution time. This catches mistakes in the
OAS document. A `$ref` also names the part of `components` that
it reads, and `#resolveOasOnce` compares that part with `refType`
before the lookup. A request-body schema with `$ref:
'#/components/parameters/userId'` throws `Ref type mismatch` on
`.resolve()`. The parser logs a `REF_TYPE_MISMATCH` error at each
such place and removes what holds the `$ref`. A generator never gets
one (see [Refs that name nothing](#refs-that-name-nothing)).

## Loops of `$ref`s

In a loop of `$ref`s, `A` is a `$ref` to `B`, and `B` is a `$ref` to
`A`. Each `resolveOnce()` names a component, but the chain never
reaches a component that is not a `$ref`. Such a chain names nothing,
the same as a `$ref` to no component:

- `toLoop()` gives the references that make the loop, or `undefined`
  when the chain reaches a component. A reference that leads into a
  loop is not part of the loop.
- `resolve()` throws `DanglingRefError` for a chain that loops. The
  error's `loop` lists the `$ref`s of the loop.
- The parser logs `DANGLING_REF` at the `$ref`s of the loop, as in
  [Refs that name nothing](#refs-that-name-nothing).

A schema that holds itself through a property, such as a tree whose
`children` are `$ref`s to the tree, is not a loop of `$ref`s. Each
step reaches an object schema.

A long chain that reaches a component resolves. There is no limit on
the number of steps.

## Ref tracking during parse

Two maps live on `ParseContext`:

- **`#refConsumers: Map<refKey, StackTrail[]>`** — every `$ref`
  encounter calls `context.registerOasRef(stackTrail.clone(), oasRef)`,
  which records the consumer under the `$ref` string. (The GraphQL
  parser calls `context.registerRef(stackTrail.clone(), typeName)`.)
  This builds the "who pointed at this ref?" inverse index. The
  `.clone()` is essential: trails are mutable, and an
  un-cloned trail would mutate as the walk returned through parent
  frames. See
  [the StackTrail reference](../reference/api/stack-trail.md)
  for the full clone-on-store discussion.

- **`#refErrors: Map<refKey, unknown[]>`** — when a parse error
  happens at a component position, `logIssueNoKey` auto-registers
  the error against the ref. This builds "what went wrong with this
  ref?"

The two maps together feed cascade pruning. They share a key
namespace (the `$ref` string) reached from two directions: ref
encounters populate `#refConsumers` from the literal `$ref` in the
document; error registration populates `#refErrors` from the
*current trail* converted via `StackTrail.toStackRef()`. See
[the StackTrail reference](../reference/api/stack-trail.md)
for that address-bridging step.

## Refs that name nothing

`registerOasRef` also keeps each `OasRef` with the place that has it.
At end-of-parse, before the cascade, `ParseContext` resolves each one
once, at that place. When a `$ref` names nothing in the document,
`resolveOnce()` throws `DanglingRefError`, and the place logs a
`DANGLING_REF` issue. A `$ref` in a [loop](#loops-of-refs) also names
nothing, and its place logs a `DANGLING_REF` issue too. The
`client.json` setting
`settings.system.danglingRefs` lists the kinds of `$ref` that can name
nothing. The default list is empty.

- A kind that is not in the list: an error. In a component, the error
  goes into `#refErrors`, so the cascade removes the component and what
  uses it. Outside the components, `ParseContext` removes what holds
  the `$ref` at once. That is the operation that has the `$ref`. For a
  path-level parameter, it is each operation on the path.
- A kind in the list: a warning. The `$ref` stays, and `resolveOnce()`
  throws `DanglingRefError` for it. In a loop, `resolveOnce()` still
  names the next component, and `resolve()` throws `DanglingRefError`.
  The generator decides what to do.
  For example, it writes `unknown` for a schema, or fails the operation
  for a parameter. Test for the error with `DanglingRefError.is(error)`.

When `resolveOnce()` throws another error, the `$ref` names an item of
the wrong kind. The place logs a `REF_TYPE_MISMATCH` error, and the
parser removes what holds the `$ref` in the same way. The list does not
apply: the parser gives a generator only what the place promises.

A `$ref` to a component that failed to parse already has an error in
`#refErrors`. That `$ref` gets no `DANGLING_REF`.

Some `$ref`s are not `OasRef`s. Core resolves them during the parse to
merge the members of an `allOf`, so a generator does not see them. A
member that leads into a loop of `$ref`s also names nothing.

When a member names nothing and the list has `allOfMember`, core leaves the
member out of the merge (`A & unknown` is `A`). The model then has no
properties from that member. Otherwise the item that has the `allOf`
gets a `DANGLING_REF` error, and the parser removes it. The list has
`allOfMember` apart from `schema` because here core, not the generator,
makes the decision.

Core also merges in a `oneOf` or an `anyOf`: the `allOf` of a member,
and each member with the keywords next to the union. The same rule
applies to these `$ref`s. The union merge removes a pair of members that
contradict. A `$ref` that names nothing is not a contradiction, so the
merge does not remove a member for it.

An operation depends on each security scheme in its `security`, also
when it gets them from the root `security`. The parser registers the
operation as a consumer of each scheme, so the cascade removes the
operation together with the scheme.

## Cascade pruning

At end-of-parse, `removeErroredItems` walks both maps together.
It removes each component that has an error, also an error in
only one property. It removes every consumer (anything that
`$ref`-ed it) from the parsed document. Each removal logs one
`INVALID_DEPENDENCY_REF` issue at the location of the consumer.

This cascade is **transitive**. A removed consumer can be a
component. Then `removeErroredItems` removes the consumers of that
component too, at all depths. No item that stays has a ref to a
removed component.

See [error handling philosophy](../explanation/error-handling-philosophy.md#tier-2-cross-ref-via-removeerroreditems)
for more on the cascade model.

## Common questions

### What's the difference between `refType` and `oasType`?

- `refType` is what the `OasRef` *expects* to resolve to. It's
  declared at construction time (`new OasRef({ refType: 'schema',
  ... })`) based on the parser's context — e.g., the parser at a
  request-body schema position creates `OasRef<'schema'>`.
- `oasType` is what the *resolved value* actually is. On a parsed
  schema variant, `oasType` is `'schema'`. On a parsed parameter,
  it's `'parameter'`. Etc.

The integrity check compares `refType` (expected) against `oasType`
(actual). Mismatch means the OAS document has a wrong-bucket ref.

### Can I have a ref to a ref?

Yes. `$ref: '#/components/schemas/AliasToUser'` where `AliasToUser`
is itself `{ $ref: '#/components/schemas/User' }` resolves correctly
via `resolve()`. The intermediate `OasRef` is followed transparently.

A chain of any length resolves when it reaches a component. A chain
that loops names nothing (see [Loops of `$ref`s](#loops-of-refs)).

### What if I resolve a ref that was pruned?

`resolveOnce()` throws `DanglingRefError`. A parse error does not
cause this: the cascade removes every item that reaches a removed
component, at all depths. By default, the cascade also removes a
`$ref` to a component that the document does not define. When
`settings.system.danglingRefs` lists the kind of the `$ref`, it stays,
and `resolveOnce()` throws for it. If the generator
does not catch the error, the engine marks the item `'error'` in the
manifest.

### When should I use `resolve()` vs `resolveOnce()`?

Almost always `resolve()`. The exception is when you specifically
want to detect "this is a ref chain" — e.g., for tooling that
displays the resolution path. Generator code almost never cares about
intermediate hops; it wants the underlying schema.

### Is `OasRef` covariant in its type parameter?

Yes, structurally. An `OasRef<'schema'>` is a `OasRef<'schema'>`;
the type parameter is the `refType`. Different ref types
(`OasRef<'schema'>` vs `OasRef<'parameter'>`) are distinct types.
This is what enforces the integrity check at the type level — a
function declaring `OasRef<'schema'>` can't be passed an
`OasRef<'parameter'>`.

### Can `OasRef` point to refs in external documents?

Not currently. Core resolves a `$ref` within `context.parsedDocument`,
which holds one document. Core reads only the fragment of a `$ref`. For
`other.yaml#/components/schemas/User` it looks up this document's
`#/components/schemas/User`, which names nothing when this document has
no `User`. If your OAS uses multi-file refs, bundle them
into a single document before passing to Skmtc (tools like
`@redocly/cli bundle` do this).

### Does Render phase resolve refs?

No. Render is pure serialization of the file map. By the time Render
runs, generators have already resolved any refs they cared about
during Generate. The `parsedDocument` is still accessible in theory
but Render doesn't touch it.

## Further reading

- [The three phases](the-three-phases.md) — where refs are constructed and resolved
- [Error handling philosophy](../explanation/error-handling-philosophy.md) — the cascade-pruning model
- [StackTrail reference](../reference/api/stack-trail.md) — the position-stack that addresses ref consumers and bridges to `$ref` strings
- [The type system](the-type-system.md) — how a model generator's `schemaToValueFn` handles `OasRef<'schema'>` alongside the schema variants
- [API reference: oas-ref](../reference/api/oas-ref.md) — full method signatures
- [API reference: oas-schema-variants](../reference/api/oas-schema-variants.md) — the schema union
- [Error codes](../reference/error-codes.md) — the ref-failure messages and their remediations
