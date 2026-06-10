# Refs and resolution

> How OpenAPI `$ref`s are parsed, tracked, and resolved through the
> SKMTC pipeline: `OasRef` as a sibling-class to schema variants,
> lazy resolution with cycle protection, forward-reference handling
> via shared mutable document, and cascade pruning when refs fail.

OAS documents express reuse through `$ref`. SKMTC's job is to make
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

SKMTC's design is different. `OasSchema` is a discriminated union:

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

SKMTC takes path 3. The trick: `OasRef` is constructed during the
walk with a reference to `context.parsedDocument`, which is the
*in-progress* parsed document. The document is **mutated as the walk
progresses** — when `User` finishes parsing, it's added to
`oasDocument.components.schemas['User']`. By the time any consumer
calls `someRef.resolve()`, the document is fully populated.

```ts
// core/oas/ref/toRefV31.ts:26-34
context.registerRef(stackTrail.clone(), $ref)

return new OasRef(
  { refType, $ref },
  context.parsedDocument  // ← reference to mutable document
)
```

The `OasRef` instance holds a live reference to `parsedDocument`.
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

See [error-handling-philosophy.md](error-handling-philosophy.md#1-empty-parsed-document-issued-at-construction-mutated-in-place)
for the symmetric `GqlDocument` application and the related
implementation choices.

## resolve() vs resolveOnce()

`OasRef` exposes two resolution methods:

- **`resolveOnce()`** — does one lookup. If the target is itself a
  `$ref` (a ref to a ref), returns the next `OasRef`. Useful when you
  want to see the immediate target.

- **`resolve()`** — recursively chases until reaching a non-ref. If
  there are 5 layers of `$ref → $ref → $ref → $ref → schema`, returns
  the schema at depth 5. Throws if the chain exceeds `MAX_LOOKUPS`
  (10).

Most consumers want `resolve()` — they don't care whether the path
is direct or indirect, they want the underlying schema.

```ts
// Typical usage in a generator
const schema = bodyRef.resolve()  // unwraps any ref chain
if (schema.type === 'object') {
  // work with the resolved object schema
}
```

## Type integrity check on resolution

`resolveOnce()` performs a type-integrity check. The check ensures
the resolved value is of the *expected* `refType`:

```ts
resolveOnce(): OasRef<T> | ResolvedRef<T> {
  const refName = toRefName(this.$ref)
  const resolved = this.#resolveOasOnce(...) ?? this.#resolveGqlOnce(...)

  if (!resolved) {
    throw new Error(`Ref "${this.#fields.$ref}" not found`)
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
`refType`) throws at resolution time. This catches authoring mistakes
in the OAS document — e.g., a path that says `$ref:
'#/components/parameters/userId'` in a request-body schema position
(wrong component bucket) would throw on `.resolve()` with a clear
error.

## Cycle protection: MAX_LOOKUPS

What about `A → B → A → B → ...` cycles?

```ts
// core/oas/ref/Ref.ts:16
const MAX_LOOKUPS = 10
```

`resolve()` tracks recursion depth. If it exceeds 10 hops, it throws
`Max lookups reached`. This catches cycles before they crash with
stack overflow.

The number 10 is deliberately small. Real OAS schemas almost never
need a ref chain longer than 2-3 hops. A 10-hop chain is essentially
always a cycle or a pathological schema worth flagging.

## Ref tracking during parse

Two maps live on `ParseContext`:

- **`#refConsumers: Map<refKey, StackTrail[]>`** — every `$ref`
  encounter calls `context.registerRef(stackTrail.clone(), $ref)`.
  This builds the "who pointed at this ref?" inverse index. The
  `.clone()` is essential: trails are mutable, and an
  un-cloned trail would mutate as the walk returned through parent
  frames. See
  [the-stack-trail.md](the-stack-trail.md#the-clone-on-store-rule)
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
[the-stack-trail.md](the-stack-trail.md#tostackref-the-address-bridge)
for that address-bridging step.

## Cascade pruning

At end-of-parse, `removeErroredItems` walks both maps:

```ts
for (const [refKey, errors] of this.#refErrors) {
  for (const error of errors) {
    const consumers = this.#refConsumers.get(refKey) ?? []
    for (const stackTrail of consumers) {
      const removed = oasState.oasDocument.removeItem(stackTrail)
      if (removed) {
        this.issues.push({
          type: 'INVALID_DEPENDENCY_REF',
          level: 'error',
          location: stackTrail.toString(),
          ...
        })
      }
    }
  }
}
```

For each failed schema, every consumer (anything that `$ref`-ed it)
is pruned from the parsed document. Each pruning logs an
`INVALID_DEPENDENCY_REF` issue at the consumer's location.

This cascade is **one-hop deep**. Transitive consumers
(consumers-of-consumers) are not pruned at this stage. They may
fail at generate time when the now-missing ref is resolved.

See [error handling philosophy](error-handling-philosophy.md#tier-2-cross-ref-via-removeerroreditems)
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

`MAX_LOOKUPS` caps the chain length at 10.

### What if I resolve a ref that was pruned?

`resolveOnce()` throws `Ref "..." not found`. This typically happens
when a generator runs against the parsed document and a depth-2+
cascade missed pruning the consumer. The generator's try/catch
catches it; the operation is marked `'error'` in the manifest.

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

Not currently. The `$ref` is resolved within `context.parsedDocument`,
which is single-document. External `$ref`s (e.g.,
`$ref: 'other.yaml#/User'`) aren't supported. If your OAS uses
multi-file refs, bundle them into a single document before passing
to SKMTC (tools like `@redocly/cli bundle` do this).

### Does Render phase resolve refs?

No. Render is pure serialization of the file map. By the time Render
runs, generators have already resolved any refs they cared about
during Generate. The `parsedDocument` is still accessible in theory
but Render doesn't touch it.

## Further reading

- [The three phases](the-three-phases.md) — where refs are constructed and resolved
- [Error handling philosophy](error-handling-philosophy.md) — the cascade-pruning model
- [The StackTrail](the-stack-trail.md) — the position-stack that addresses ref consumers and bridges to `$ref` strings
- [The type system](the-type-system.md) — how a model generator's `schemaToValueFn` handles `OasRef<'schema'>` alongside the schema variants
- [API reference: oas-ref](../reference/api/oas-ref.md) — full method signatures
- [API reference: oas-schema-variants](../reference/api/oas-schema-variants.md) — the schema union
- [`skmtc-debug` skill](../skills/skmtc-debug/SKILL.md) — operational diagnosis of ref failures
