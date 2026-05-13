# GraphQL document model

> The GraphQL-side container classes: `GqlDocument`, `GqlRegistry`,
> `GqlOperation`, `GqlArgument`, `GqlRootTypes`. Mirrors the role of
> `OasDocument` / `OasComponents` / `OasOperation` for the GraphQL
> protocol — but without HTTP-flavored fields.

For why GraphQL is parsed worker-side (unlike OAS) and how the
protocol-asymmetry affects the pipeline, see
[the-graphql-asymmetry.md](../../explanation/the-graphql-asymmetry.md).
For type-mapping rules (how `[T!]!` becomes `OasArray`, how
`interface` produces both an object and a union, etc.), see the
"Type-mapping rules" section in `core/gql/CLAUDE.md`.

## Source

- `skmtc/deno/core/gql/document/GqlDocument.ts`
- `skmtc/deno/core/gql/registry/GqlRegistry.ts`
- `skmtc/deno/core/gql/operation/GqlOperation.ts`
- `skmtc/deno/core/gql/argument/GqlArgument.ts`
- `skmtc/deno/core/gql/rootType/GqlRootTypes.ts`

## Design — what's shared, what's not

The schema vocabulary is **protocol-neutral**: GraphQL types are
represented using existing OAS classes
(`OasObject`, `OasUnion`, `OasArray`, `OasString`, `OasInteger`,
`OasNumber`, `OasBoolean`, `OasRef<'schema'>`). Model generators
(`gen-typescript`, `gen-zod`, etc.) consume `TypeSystemValue`
derived from these and work unchanged across protocols.

What's GraphQL-specific is the *container* shape: `GqlDocument`,
`GqlRegistry`, `GqlOperation`, `GqlArgument`, `GqlRootTypes`.
These have no HTTP analogues (no path, no method, no status
codes, no media types).

## `GqlDocument`

```ts
class GqlDocument {
  readonly oasType: 'gqlDocument'

  constructor(fields?: GqlDocumentFields)

  set fields(fields: GqlDocumentFields): void

  get registry(): GqlRegistry            // throws before fields set
  get operations(): GqlOperation[]       // throws before fields set
  get rootTypes(): GqlRootTypes          // throws before fields set
  get info(): OasInfo | undefined        // throws before fields set

  removeItem(stackTrail: StackTrail): unknown
}

type GqlDocumentFields = {
  registry: GqlRegistry
  operations: GqlOperation[]
  rootTypes: GqlRootTypes
  info?: OasInfo
}
```

The GraphQL counterpart to `OasDocument`. Same
**empty-at-construction** pattern as `OasDocument` — the parser
creates an empty instance up front so `OasRef`s constructed during
parse have a stable resolution target, then populates
`gqlDocument.fields = { ... }` at the end. See
[refs-and-resolution.md](../../concepts/refs-and-resolution.md#the-forward-ref-problem)
and
[error-handling-philosophy.md](../../concepts/error-handling-philosophy.md#1-empty-parsed-document-issued-at-construction-mutated-in-place).

### `removeItem(stackTrail)`

The GraphQL cascade-pruning hook, parallel to
`OasDocument.removeItem`. Handles three consumer shapes:

| Trail shape | Action |
|---|---|
| `[<RootType>, <fieldName>, …]` where `<RootType>` matches `rootTypes.{query,mutation,subscription}` | Remove the matching `GqlOperation` from `operations` |
| `[<UnionType>, 'members', <index>]` | Remove the indexed member from a `OasUnion` |
| `[<ParentType>, <fieldName>, …]` where `<ParentType>` is a registered object/input/interface | Delete the field from `OasObject.properties` (and from `required` if listed) |

Returns the removed entity (truthy) when removal happened, or
`undefined` when no matching consumer was found. The truthy
return is what `ParseContext.removeErroredItems` uses to log an
`INVALID_DEPENDENCY_REF` issue.

## `GqlRegistry`

```ts
class GqlRegistry {
  schemas: Record<RefName, OasSchema | OasRef<'schema'>>

  constructor(fields: GqlRegistryFields)

  createRef(refName: RefName): OasRef<'schema'>
  toSchemasRefNames(): RefName[]
}

type GqlRegistryFields = {
  schemas: Record<RefName, OasSchema | OasRef<'schema'>>
}
```

The named-type registry. Parallel to `OasComponents.schemas`.

### Ref resolution mechanism

`GqlRegistry` owns a private `OasDocument` mirror whose
`components.schemas` is **the same `Record` instance** as
`registry.schemas`. Refs created via `registry.createRef(refName)`
point at this internal mirror. This lets GraphQL types use the
existing `OasRef` machinery — including the `MAX_LOOKUPS` cycle
guard and the type-integrity check at resolve time — without
subclassing or modifying `OasRef`.

Consumers see only `registry.schemas`; the mirror is an
implementation detail. **Do not construct `OasRef` directly when
parsing GraphQL** — use `registry.createRef(refName)` so the ref
resolves through the registry's mirror.

### `createRef(refName)`

Returns an `OasRef<'schema'>` that resolves through the
registry. Used by the parser when constructing
`OasObject.properties[fieldName] = registry.createRef(targetTypeName)`
for cross-type references.

### `toSchemasRefNames()`

Returns the registered type names. Used by the model dispatcher
(`#runModelGenerator` in `GenerateContext`) to iterate types. The
matching `OasComponents.toSchemasRefNames` exists on the OAS side
— the protocol-neutral model dispatch reads whichever one
applies based on `document.type`.

## `GqlOperation`

```ts
class GqlOperation {
  readonly oasType: 'gqlOperation'

  constructor(fields: GqlOperationFields)

  get fieldName(): string
  get rootKind(): GqlRootKind
  get arguments(): GqlArgument[]
  get returnType(): OasSchema | OasRef<'schema'>
  get returnTypeString(): string
  get description(): string | undefined
  get deprecated(): boolean
  get deprecationReason(): string | undefined
  get identifier(): Identifier
}

type GqlOperationFields = {
  fieldName: string
  rootKind: GqlRootKind
  arguments: GqlArgument[]
  returnType: OasSchema | OasRef<'schema'>
  returnTypeString: string
  description?: string
  deprecated?: boolean
  deprecationReason?: string
}

type GqlRootKind = 'query' | 'mutation' | 'subscription'
```

A single root-level field exposed as a Query, Mutation, or
Subscription. The GraphQL counterpart to `OasOperation`.

### Differences from `OasOperation`

| `OasOperation` field | `GqlOperation` equivalent |
|---|---|
| `path: string` | (none — operations don't have paths) |
| `method: Method` | `rootKind: 'query' \| 'mutation' \| 'subscription'` |
| `operationId?: string` | (none — `fieldName` plays this role) |
| `parameters: OasParameter[]` | `arguments: GqlArgument[]` |
| `requestBody?: OasRequestBody` | (none — GraphQL passes args, not bodies) |
| `responses: Record<status, OasResponse>` | `returnType: OasSchema \| OasRef` (one return type, no status codes) |

### `identifier`

A computed `Identifier` whose name is derived from `rootKind`
and `fieldName` (e.g., `Identifier.createType('Query_getUser')`).
Used by generators that need a canonical TypeScript name for the
operation.

### `synthesizeArgsObject(operation)`

Helper at `core/gql/operation/synthesizeArgsObject.ts`. Builds an
`OasObject` representing an operation's arguments as a single
object schema — useful for generators that want one TypeScript
type per operation's input.

## `GqlArgument`

```ts
class GqlArgument {
  readonly oasType: 'gqlArgument'

  get name(): string
  get type(): OasSchema | OasRef<'schema'>
  get defaultValue(): unknown | undefined
  get description(): string | undefined
  get deprecated(): boolean
  get deprecationReason(): string | undefined
  get required(): boolean
}
```

A single argument on a `GqlOperation`. The required-ness is
derived from the GraphQL nullability: `String!` produces
`required: true`, `String` produces `required: false`.

## `GqlRootTypes`

```ts
type GqlRootTypes = {
  query?: string
  mutation?: string
  subscription?: string
}
```

Pointers to the schema's root operation types — the names a
GraphQL schema gives to its `Query`, `Mutation`, and
`Subscription` types (which default to those literal names but
can be renamed via `schema { query: MyRoot }`).

Used by:

- `GqlDocument.removeItem` to detect "this consumer trail is a
  root-field path."
- Generators that want to reference the root types by name.

## Type-mapping rules (summary)

For the full table, see `core/gql/CLAUDE.md`. Highlights:

- Built-in scalars (`Int`, `Float`, `String`, `Boolean`, `ID`) →
  `OasInteger` / `OasNumber` / `OasString` / `OasBoolean`. Not
  registered as schemas.
- Custom scalars (`DateTime`, `JSON`, etc.) → `OasString` with
  `format: '<scalarName>'`. Registered.
- `type X { ... }` → `OasObject` registered under
  `RefName('X')`.
- `input XInput { ... }` → `OasObject` registered under
  `RefName('XInput')` (object/input duality preserved — they're
  distinct names).
- `interface I` → both an `OasObject` (the base) **and** an
  `OasUnion` (over implementers) registered as
  `RefName('IUnion')` by default.
- `union U = A | B` → `OasUnion` with
  `discriminator: { propertyName: '__typename' }`.
- `[T!]!` / `[T!]` / `[T]!` / `[T]` → `OasArray` with appropriate
  `nullable` flags on container and items.
- `[[T]]` (nested list) → `OasUnknown` — v1 limitation.

## Parser entry points

The SDL → `GqlDocument` parser lives at
`core/parsers/graphql/toGqlDocument.ts`. Sub-export
`@skmtc/core/parsers/graphql` — kept separate from the top-level
`mod.ts` so consumers that only need the data model don't pull
`graphql` (the npm package) into their type-check graph.

For running the full pipeline against GraphQL, see
`toArtifactsFromGraphQL` (sibling to `toArtifacts` for OpenAPI).

## Known limitations (v1)

- **Nested lists** (`[[T]]`) → `OasUnknown`.
- **Directives** dropped. (Apply via `extensionFields` if needed
  in v2.)
- **Fragments / fragment masking** — not handled. Schema-driven
  generation only.
- **Subscriptions** — typed at the schema level; no transport
  wiring is generated.
- **Federation** (`@key`, `@external`, etc.) — out of scope.

## See also

- [Concept: the GraphQL pipeline](../../concepts/the-graphql-pipeline.md)
  — the type-mapping rules, shared `OasSchema` vocabulary, scalar
  configuration, and operation generator patterns
- [Explanation: the GraphQL asymmetry](../../explanation/the-graphql-asymmetry.md)
  — why GraphQL is parsed worker-side
- [Concept: refs and resolution](../../concepts/refs-and-resolution.md)
  — how `OasRef` resolves through `GqlRegistry`'s mirror
- [Concept: error handling philosophy](../../concepts/error-handling-philosophy.md)
  — the cascade-pruning machinery `GqlDocument.removeItem`
  participates in
- [API: OAS document model](oas-document-model.md) — the OAS-side
  sibling (mostly different fields, same parsed-document role)
- [API: OAS schema variants](oas-schema-variants.md) — the union
  GraphQL types are mapped into
- [API: OasRef](oas-ref.md) — the ref class GraphQL types use via
  `GqlRegistry.createRef`
