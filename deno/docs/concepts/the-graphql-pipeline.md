# The GraphQL pipeline

> How the GraphQL side of SKMTC works: schema vocabulary shared
> with OAS (GraphQL types are mapped to `OasObject`, `OasUnion`,
> `OasArray`, `OasRef`), what's GraphQL-specific (containers,
> operations, scalars, interface-union handling), and what
> generator authors need to know to target GraphQL.

For the asymmetry of *where* parsing happens (host-side for OAS,
worker-side for GraphQL), see
[explanation/the-graphql-asymmetry.md](../explanation/the-graphql-asymmetry.md).
This page covers what comes *after* the parse — how a parsed
GraphQL schema is represented, what's shared with OAS, and how
to write generators against it.

## The one-line definition

GraphQL types are mapped onto the existing `OasSchema` family —
the same eight sibling classes that represent OAS schemas
(`OasObject`, `OasArray`, `OasUnion`, `OasString`, `OasInteger`,
`OasNumber`, `OasBoolean`, `OasUnknown`) plus `OasRef<'schema'>`.
Containers and operations are GraphQL-specific (`GqlDocument`,
`GqlRegistry`, `GqlOperation`, `GqlArgument`). Model generators
(`gen-typescript`, `gen-zod`, etc.) work unchanged across both
protocols because the schema vocabulary is protocol-neutral.

## The shared substrate

The single most clarifying fact about the GraphQL pipeline: at
the schema level, **the vocabulary is identical to OAS**. A
`type User { name: String! }` in GraphQL becomes the same
`OasObject` instance you would get from a `User` schema in OAS.

This means:

- **`schemaToValueFn` dispatches don't need GraphQL-specific
  branches.** `gen-typescript`'s `toTsValue`, `gen-zod`'s
  `toZodValue`, etc., handle GraphQL types via the same `'object'`
  / `'array'` / `'string'` arms that handle OAS types. See
  [the-type-system.md](the-type-system.md).
- **Cross-generator coordination works the same way.** A
  GraphQL operation generator that needs a TypeScript type for an
  argument calls `context.insertNormalizedModel(TsProjection, { schema, fallbackName, destinationPath })`
  — same API as on the OAS side. The argument schema is an
  `OasObject`, the recipient generator handles it natively.
- **Refs work the same way.** GraphQL cross-type references
  become `OasRef<'schema'>`. The same `resolve()` /
  `resolveOnce()` machinery, the same lazy-resolution model, the
  same cycle detection via `modelDepth`. See
  [refs-and-resolution.md](refs-and-resolution.md) and
  [the-type-system.md §Handling recursive types](the-type-system.md#handling-recursive-types--the-modeldepth-counter).

What's GraphQL-specific is the *container* layer
(`GqlDocument`, `GqlRegistry`, `GqlOperation`, `GqlArgument`) and
the operation-level concepts (root kinds, field names, no HTTP
verbs). Everything below that level is shared.

## Type-mapping rules

The parser at `core/parsers/graphql/` translates GraphQL kinds to
SKMTC's protocol-neutral classes:

| GraphQL | SKMTC representation |
|---|---|
| `Int!` | `OasInteger` (`format: 'int32'`, `nullable: false`) |
| `Float!` | `OasNumber` (`format: 'float'`, `nullable: false`) |
| `String!` | `OasString` |
| `Boolean!` | `OasBoolean` |
| `ID!` | `OasString` with `format: 'id'` |
| Custom scalar `Foo!` | `OasString` with `format: 'Foo'` |
| `enum Role { A B }` | `OasString` with `enums: ['A', 'B']`, registered |
| `type User { ... }` | `OasObject` registered under `RefName('User')` |
| `input UserInput { ... }` | `OasObject` registered under `RefName('UserInput')` |
| `interface I` | `OasObject` (base) **and** `OasUnion` (over implementers) |
| `union U = A \| B` | `OasUnion` with `discriminator.propertyName = '__typename'` |
| `[T!]!` / `[T!]` / `[T]!` / `[T]` | `OasArray` with appropriate `nullable` flags on container and items |
| `[[T!]!]!` (nested list) | `OasUnknown` — v1 limitation |
| Reference to named type | `OasRef<'schema'>` via `registry.createRef(refName)` |
| Root field on Query/Mutation/Subscription | `GqlOperation` — *not* registered as a schema |

Three patterns in this table deserve their own sections.

### Object vs input duality

GraphQL keeps object types and input types in **disjoint
namespaces**. `User` (a `type`) and `User` (an `input`) are
distinct identities — the language allows both names to coexist.
The parser preserves this: it registers both under their own
`RefName` values, with no merging and no structural
deduplication.

In practice, the convention is `<Name>Input` for input types
(GraphQL community standard), so the registry holds `User` and
`UserInput` as siblings. Generators iterating
`registry.toSchemasRefNames()` see both and produce two
artifacts.

If your generator assumes "one TypeScript type per logical
type," it will be wrong for GraphQL. The two refNames are
distinct cache keys with distinct outputs.

### Interface union pattern

A GraphQL `interface` is dual-purposed: it's both a *base
contract* (other types `implements I`) and a *polymorphic
reference* (a field can be typed `I` and resolve to any
implementer). To model both roles, the parser produces **two
artifacts** per interface:

- An `OasObject` named after the interface (e.g., `Node`), with
  whatever fields the interface declares.
- An `OasUnion` named with a suffix (default `NodeUnion`), whose
  members are the implementing types.

A field typed `I` becomes a ref to `<I>Union` so that consumers
get exhaustive discriminated-union narrowing.

Two parse options control this:

```ts
type GqlParseOptions = {
  interfaceUnionSuffix?: string         // default: 'Union'
  synthesizeInterfaceUnions?: boolean   // default: true
}
```

`interfaceUnionSuffix` changes the suffix (e.g., to `'Variant'`
or `'Impl'`); `synthesizeInterfaceUnions: false` suppresses the union
entirely, leaving only the base object. The latter is useful if
your downstream stack doesn't need the polymorphic representation
(e.g., you generate only TypeScript types and the `Node`
interface alone is enough).

These options live on `GqlParseOptions` in
`core/context/parseTypes.ts`. They're passed to `toGqlDocument`
or to `ParseContext`'s constructor via `options.gql`.

### Discriminated unions and `__typename`

Every `OasUnion` produced from a GraphQL `union` or interface
implementer set carries
`discriminator: { propertyName: '__typename' }`. This is the
GraphQL convention — clients receive `__typename` in the
response and use it to narrow.

Downstream generators (`gen-typescript`, `gen-zod`, etc.) read
the discriminator and produce target-language code that exploits
it. Zod, for instance, can produce `z.discriminatedUnion('__typename', [...])`,
which gives clients faster runtime checks than a generic
union parse.

## Scalar handling

### Built-in scalars

`Int`, `Float`, `String`, `Boolean`, `ID` are inlined at usage
sites only — they **don't** produce registry entries. A field
typed `Int!` becomes an `OasInteger` directly on the parent
object's `properties`; no `RefName('Int')` exists.

This avoids polluting the registry with names that aren't
user-meaningful. The registry holds *user-defined* types only.

### Custom scalars

A custom scalar (`scalar DateTime`, `scalar JSON`, etc.) doesn't
fit any built-in shape. The parser produces an `OasString` with
the scalar's name in the `format` field. So `field: DateTime!`
becomes `OasString` with `format: 'DateTime'`.

The parser is **scalar-agnostic** — it just passes the name
through. The decision about what TS / Zod / etc. type to produce
lives in the downstream generator's scalar map.

### Configuring downstream scalar mapping

`gen-typescript` accepts a scalar configuration via
`toTypescriptEntry`:

```ts
import { toTypescriptEntry } from '@skmtc/gen-typescript'

const typescript = toTypescriptEntry({
  scalars: {
    DateTime: 'string',
    JSON: 'Record<string, unknown>',
    BigInt: 'bigint'
  }
})
```

The `scalars` map merges into a built-in defaults table; pass
`replaceScalars: true` to override defaults entirely. Built-in
OpenAPI formats (`date-time`, `email`, `uuid`) default to
`string`; unknown formats default to `unknown` (consistent with
the survey across graphql-codegen / gql.tada / genql), so users
notice and configure.

The same pattern works for any model generator that wants to
make custom scalars configurable. Mirror `gen-typescript`'s
`toXxxEntry({ scalars })` shape — read the scalar-name from the
`format` field on `OasString`, look it up in your map, fall back
to a safe default.

## Operations and arguments

GraphQL operations are root-level fields. The parser surfaces
them as `GqlOperation` entries in `gqlDocument.operations`
**without** registering them as schemas. Differences from
`OasOperation`:

| `OasOperation` field | `GqlOperation` equivalent |
|---|---|
| `path: string` | (none — operations don't have paths) |
| `method: Method` | `rootKind: 'query' \| 'mutation' \| 'subscription'` |
| `operationId?: string` | (none — `fieldName` plays this role) |
| `parameters: OasParameter[]` | `arguments: GqlArgument[]` |
| `requestBody?: OasRequestBody` | (none — GraphQL passes args, not bodies) |
| `responses: Record<status, OasResponse>` | `returnType: OasSchema \| OasRef` (one return type, no status codes) |

Root types themselves (`Query`, `Mutation`, `Subscription`) are
**not** registered as schemas — they're decomposed into
individual operations. Generators that want to reference the root types by
name use `gqlDocument.rootTypes`.

### `synthesizeArgsObject` — turning arguments into a schema

A GraphQL operation's arguments aren't a schema; they're a
typed argument list. To route them through the same schema-
registration machinery as everything else, the core helper
`synthesizeArgsObject(operation)` builds an `OasObject` whose
properties are the arguments.

```ts
// core/gql/operation/synthesizeArgsObject.ts
export const synthesizeArgsObject = (operation: GqlOperation): OasObject | undefined => {
  if (operation.arguments.length === 0) return undefined
  const properties: Record<string, OasSchema | OasRef<'schema'>> = {}
  const required: string[] = []
  for (const arg of operation.arguments) {
    properties[arg.name] = arg.schema
    if (arg.required && arg.defaultValue === undefined) {
      required.push(arg.name)
    }
  }
  return new OasObject({
    title: `${operation.fieldName} arguments`,
    properties,
    required: required.length > 0 ? required : undefined
  })
}
```

Returns `undefined` for operations that take no arguments — the
caller can use that to skip producing an args type entirely (or
register `Record<string, never>` as the stock generators do).

One non-obvious behavior: arguments that are both `required: true`
**and** have a non-undefined `defaultValue` are *not* listed as
required. The server fills the default if the caller omits the
argument, so surfacing it as required at the consumer side would
be misleading.

The helper lives in core (not in any generator package) so any
GraphQL operation generator can reuse it. Authors writing a new
GraphQL operation generator should reach for `synthesizeArgsObject`
before hand-rolling an args-to-schema translator.

## Operation generator patterns

GraphQL operation generators use the **class-based** pattern
— a subclass of the base returned by `toTsGqlOperationProjectionBase`,
with `toIdentifierName` / `toExportPath` static methods, exactly like
the OAS-side `toTsOasOperationProjectionBase` users.

```ts
// gen-graphql-client/src/base.ts
export const GraphqlClientBase = toTsGqlOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  toIdentifierName({ operation }) {
    return `use${capitalize(operation.fieldName)}`
  },
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath({ operation, enrichments, variant }) {
    const name = this.toIdentifierName({ operation, enrichments, variant })
    return join('@', 'graphql', `${name}.generated.ts`)
  }
})

// gen-graphql-client/src/mod.ts
export const graphqlClientEntry = toGqlOperationEntry({
  id: denoJson.name,
  isSupported: ({ operation }) => synthesizeArgsObject(operation) !== undefined,
  transform: ({ context, operation }) => {
    context.insertOperation({ projection: GraphqlClient, operation })
  },
  toEnrichmentSchema
})
```

The functional pattern (a free `emitOperation` helper called from
`transform`) is no longer represented in stock: the two earlier
packages that used it — `@skmtc/gen-graphql-operation` and
`@skmtc/gen-graphql-typed-document-node` — were deleted on
2026-05-13 after a zero-consumer audit confirmed neither had real
`.ts` consumers anywhere in the workspace. Both were thin wrappers
that delegated to `TsProjection` for the bulk of their work. New
GraphQL operation generators should follow the class-based pattern.

### When to use the class-based pattern instead

If you author a GraphQL operation generator whose output is
referenced by peer generators (a hypothetical `gen-graphql-shadcn-form`
analog to the OAS form generator), use your language package's
`toTsGqlOperationProjectionBase` veneer to declare a Projection class.
The factory mirrors `toTsOasOperationProjectionBase`:

```ts fragment
import { toTsGqlOperationProjectionBase } from '@skmtc/lang-typescript'

export const MyGqlFormBase = toTsGqlOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toIdentifierName: ({ operation }) =>
    `${capitalize(operation.fieldName)}Form`,
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: ({ operation }) => join('@', 'forms', `${operation.fieldName}.tsx`),
  toEnrichmentSchema,
  isSupported: () => true
})

export class MyGqlForm extends MyGqlFormBase {
  constructor({ context, operation, settings }) {
    super({ context, operation, settings })
    // ... pull peer artifacts via insertOperation / insertNormalizedModel
    // ... register imports
  }
  override toString() { /* JSX template */ }
}
```

Same coordination model as the OAS counterpart. The Driver layer
(`GqlOperationDriver`) handles the cache and integrity exactly
like `OasOperationDriver` — only the cache-key shape differs
(`<generatorId>|<rootKind>|<fieldName>` instead of
`<generatorId>|<path>|<method>`).

The functional pattern is the default for stock generators
because no stock GraphQL generator currently needs the
cross-generator coordination layer. The class-based pattern is
available when you do.

### Authoring differences vs OAS

The pipelines share substrate, and the operation-entry shape is
largely symmetric: `transform` has the same `({ context, operation,
variant }) => void` signature, enrichments are pre-resolved the same
way (the projection base's static `toEnrichments` reads
`['enrichments', id, rootKind, fieldName, variant]`, mirroring OAS's
`[…, path, method, variant]`), and the Driver / cache / integrity
model is identical. Two genuine differences trip up authors carrying
OAS habits:

| | OAS (`toOasOperationEntry`) | GraphQL (`toGqlOperationEntry`) |
|---|---|---|
| Routing keys | `[path][method]` | `[rootKind][fieldName]` — the cache key and enrichment path key on these instead |
| Body for mutations | `operation.toRequestBody(({ schema }) => schema)` | `synthesizeArgsObject(operation)` — turns the field's arguments into an object schema you can feed to `insertNormalizedModel` |

The second asymmetry is why the same operation-reference protocol
(see [cross-generator-coordination](cross-generator-coordination.md#pattern-operation-reference-consumer-chosen-peer))
reads slightly differently in GraphQL — you index by `rootKind` +
`fieldName`, not by `path` + `method`.

## Known limitations (v1)

The parser handles the most common GraphQL features. A handful
are deferred:

- **Nested lists (`[[T]]`)** are not representable as a single
  `OasArray`. The parser detects them and produces `OasUnknown`,
  logging a `NESTED_LIST_LOSSY` warning. Generators that need
  faithful nested-list output would need an extension.
- **Applied directives** (other than `@deprecated`, whose
  `reason` is captured) are dropped during mapping. A
  `DROPPED_DIRECTIVE` warning is logged per drop. If your
  generator needs directive metadata, it isn't currently
  available downstream.
- **Schema-level directive definitions** (the `directive @x ...`
  form) are skipped with a `SKIPPED_FEATURE` warning.
- **Fragments and fragment masking** aren't handled. SKMTC is a
  schema-driven generator; document-driven generation (per-
  `.graphql` operation file with selection-set narrowing, à la
  graphql-codegen's `typescript-operations`) is a deferred
  feature.
- **Subscriptions** are typed at the schema level — they appear
  in `gqlDocument.operations` with `rootKind: 'subscription'` —
  but no transport wiring is generated. Stream support is a
  separate concern.
- **Federation directives** (`@key`, `@external`, etc.) are
  out of scope.

See [reference/error-codes.md](../reference/error-codes.md#graphql-issue-types)
for the full `GqlIssueType` enum and what each code indicates.

## Common questions

### Why do model generators work unchanged for GraphQL?

Because the schema vocabulary is shared. A model generator
(`gen-typescript`, `gen-zod`, etc.) dispatches on
`schema.type === 'object' | 'array' | 'string' | ...`. The same
discriminator values apply whether the schema came from OAS or
GraphQL. The downstream code path doesn't know the difference.

The only protocol-aware piece is the *container layer*.
`toArtifacts` reads `document.type` to pick `OasComponents` vs
`GqlRegistry` for the refName iteration. Beyond that branch, the
generator's transform receives `refName: RefName` and walks the
schema via the protocol-neutral classes.

### When would I author a GraphQL-only generator?

When the artifact is operation-shaped — a `TypedDocumentNode`
constant, a query-builder helper, a typed Apollo cache update —
or when it needs `gqlDocument.rootTypes` / `gqlDocument.registry`
in ways an OAS generator's structure doesn't provide.

Most model generators (types, validators, mappers) are protocol-
neutral by design and don't need a GraphQL-only variant.

### Why doesn't `Query` itself appear in the registry?

GraphQL's root types are special — their fields aren't members
of a schema you'd want to ref. A `type Query { ... }` whose
fields are `getUser`, `getOrders`, `getDashboard` doesn't
correspond to a useful TypeScript type. Each field is a separate
operation; the root type is a list, not a schema.

Generators that want to enumerate root fields use
`gqlDocument.operations`. Generators that need to identify the
root types by name use `gqlDocument.rootTypes.{query, mutation, subscription}`.

### Does the GraphQL parser respect `nullable: true` on responses?

Yes. The `!` suffix maps to `nullable: false`; its absence maps
to `nullable: true`. So:

- `field: String!` → `OasString` with `nullable: false`
- `field: String` → `OasString` with `nullable: true`

Likewise for list shapes: `[T!]!` is "non-null list of non-null
T," `[T]` is "nullable list of nullable T," and so on.

### Can I generate code from a `.graphql` file?

Yes — point `client.json#source` at the SDL file (`.graphql`
extension or `application/graphql` content-type). The CLI
detects the protocol from the source and routes through the
GraphQL parse path. See
[the-graphql-asymmetry.md](../explanation/the-graphql-asymmetry.md)
for what happens at the worker boundary.

### What's `GqlRegistry`'s `OasDocument` mirror trick about?

`GqlRegistry` owns a private `OasDocument` whose
`components.schemas` is **the same `Record` instance** as
`registry.schemas`. Refs created via `registry.createRef(refName)`
point at this internal mirror — which lets GraphQL types reuse
the existing `OasRef` machinery (lazy resolution, the
`MAX_LOOKUPS` cycle guard, the type-integrity check at resolve
time) without subclassing or modifying `OasRef`.

Consumers see only `registry.schemas`; the mirror is an
implementation detail. **Don't construct `OasRef` directly when
parsing GraphQL.** Use `registry.createRef(refName)` so the ref
resolves through the registry's mirror.

### How are operations addressed during cascade pruning?

`GqlDocument.removeItem(stackTrail)` handles three consumer
trail shapes:

- `[<RootType>, <fieldName>, …]` where `<RootType>` matches one
  of `rootTypes.{query,mutation,subscription}` → removes the
  matching `GqlOperation`.
- `[<UnionType>, 'members', <index>]` → removes the indexed
  member of an `OasUnion` / interface-union.
- `[<ParentType>, <fieldName>, …]` → deletes the field from
  `OasObject.properties` on a registered type.

Parallel to `OasDocument.removeItem`'s three-segment routing.
See [error-handling-philosophy.md](error-handling-philosophy.md#tier-2-cross-ref-via-removeerroreditems)
for the cascade-pruning algorithm.

### Are there OAS-side concepts that *don't* apply to GraphQL?

A few:

- **HTTP-specific OAS fields** — paths, methods, status codes,
  media types, request bodies, parameters by location (`query`
  / `header` / `cookie`) — have no GraphQL analogue. Operation-
  level generators that depend on these (a fetch-based query
  hook, an Express handler) are OAS-only.
- **`anyOf` / `oneOf` / `allOf`** — GraphQL has no equivalents.
  The parser produces `OasUnion` for `union` types and
  `OasObject` (with an `OasUnion` companion) for `interface`s,
  but doesn't synthesize `allOf`-shaped intersections.

## Further reading

- [The GraphQL asymmetry](../explanation/the-graphql-asymmetry.md) —
  why GraphQL parses worker-side
- [The type system](the-type-system.md) — the shared `OasSchema`
  / `TypeSystemValue` vocabulary that GraphQL types are mapped
  into
- [Refs and resolution](refs-and-resolution.md) — the ref
  machinery GraphQL types use via `registry.createRef`
- [How generators produce output](how-generators-produce-output.md) —
  `GenerateContext`'s iteration over GraphQL operations (routed only
  against GraphQL documents)
- [Cross-generator coordination](cross-generator-coordination.md) —
  works the same for both protocols
- [How to handle GraphQL instead of OAS](../authoring/how-to/handle-graphql-instead-of-oas.md) —
  the operational guide for authoring a GraphQL generator
- [API: GraphQL document model](../reference/api/gql-document.md) —
  full class reference
- [Reference: error codes](../reference/error-codes.md) — `GqlIssueType` enum
