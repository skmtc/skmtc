# CLAUDE.md — `core/gql/`

GraphQL data model for SKMTC. Sibling to `core/oas/`. Both protocols
flow through the same generate + render phases via the
{@link SkmtcDocument} discriminated union.

## What lives here

| File | Role |
|---|---|
| `document/GqlDocument.ts` | Top-level container: registry + operations + rootTypes + optional info |
| `registry/GqlRegistry.ts` | Named-type registry — parallel to `OasComponents.schemas` |
| `operation/GqlOperation.ts` | Per-root-field operation entity (Query/Mutation/Subscription field) |
| `operation/synthesizeArgsObject.ts` | Helper: `GqlOperation` → `OasObject` representing its args |
| `argument/GqlArgument.ts` | Single field argument (name, type, default, description, deprecation) |
| `rootType/GqlRootTypes.ts` | Pointers to the schema's root types (`{ query?, mutation?, subscription? }`) |

The SDL parser lives separately at `core/parsers/graphql/`. It produces
the entities in this directory.

## Architecture

### What's shared with OpenAPI

The schema vocabulary is **protocol-neutral**. GraphQL types are
represented using existing OAS classes:

- Object types (and input types, and interface base) → `OasObject`
- Union types → `OasUnion` with `discriminator: __typename`
- Lists → `OasArray`
- Enums → `OasString` with `enums: string[]`
- Scalars (Int / Float / String / Boolean / ID) → `OasInteger` / `OasNumber` / `OasString` / `OasBoolean`
- Custom scalars → `OasString` with `format: '<scalarName>'`
- Cross-type references → `OasRef<'schema'>`

Model generators (`gen-typescript`, `gen-zod`, `gen-valibot`,
`gen-arktype`) consume `TypeSystemValue` derived from these classes
and so work unchanged for GraphQL.

### What's protocol-specific

`GqlDocument`, `GqlRegistry`, `GqlOperation`, `GqlArgument`, and
`GqlRootTypes` are the GraphQL-side container shapes. They mirror the
roles of `OasDocument` / `OasComponents` / `OasOperation` / etc., but
without the HTTP-flavored fields (path, method, status codes, media
types, request body, etc.).

### Ref resolution mechanism

`OasRef` resolves through an `OasDocument`'s `components.schemas`. To
let GraphQL types use the same ref machinery without subclassing or
modifying `OasRef`:

`GqlRegistry` owns a private `OasDocument` mirror whose
`components.schemas` is **the same `Record` instance** as
`registry.schemas`. Refs created via `registry.createRef(refName)`
point at this internal mirror. Consumers see only `registry.schemas`;
the mirror is an implementation detail.

This keeps the public registry surface narrow while reusing OAS's
well-tested ref / cycle-detection machinery untouched.

## Usage

### Parsing SDL

```typescript
import { toGqlDocument } from '@skmtc/core/parsers/graphql'

const sdl = await Deno.readTextFile('./schema.graphql')
const gqlDocument = toGqlDocument(sdl)

// gqlDocument.registry.schemas — Record<RefName, OasSchema | OasRef<'schema'>>
// gqlDocument.operations       — GqlOperation[] (one per root field)
// gqlDocument.rootTypes        — { query?, mutation?, subscription? }
```

`toGqlDocument` accepts an SDL string, a `graphql-js` `GraphQLSchema`
instance, or a pre-built `GqlDocument`.

Options:
- `interfaceUnionSuffix` (default `'Union'`) — name of the synthesized
  union form registered alongside an interface's base object
- `synthesizeInterfaceUnions` (default `true`) — whether to register a
  synthetic union of an interface's implementers (under
  `<interfaceName><interfaceUnionSuffix>`) in addition to the base
  interface object

### Running the full pipeline

Use `toArtifactsFromGraphQL` (re-exported from
`@skmtc/core/parsers/graphql`) — sibling to `toArtifacts` for OpenAPI:

```typescript
import { toArtifactsFromGraphQL } from '@skmtc/core/parsers/graphql'
import { StackTrail } from '@skmtc/core'

const result = toArtifactsFromGraphQL({
  traceId: 'gen',
  spanId: 'main',
  startAt: Date.now(),
  source: sdl, // or a GqlDocument or GraphQLSchema
  settings: { basePath: './generated' },
  toGeneratorConfigMap: () => ({
    typescript: typescriptEntry,
    gqlOperation: graphqlOperationEntry
  }),
  silent: false,
  stackTrail: new StackTrail(['gen'])
})
```

### Writing a GraphQL-targeted operation generator

GraphQL-targeted generators are built with `toGqlOperationEntry` and
get a `GqlOperation`-typed `operation` parameter on `transform` —
**no runtime cast required**. The dispatcher routes them only against
GraphQL documents, so `isSupported` and `transform` can assume a
`GqlOperation`.

```typescript
import { toGqlOperationEntry } from '@skmtc/core'

export const myEntry = toGqlOperationEntry({
  id: '@scope/my-gen',
  isSupported: () => true,
  transform: ({ context, operation }) => {
    // operation is GqlOperation; access fieldName / arguments / returnType
    // directly. Emit via context.insertOperation / insertNormalizedModel.
  }
})
```

Sibling helpers exist for OpenAPI: `toOperationEntry` (the original
HTTP form) and `toModelEntry` (protocol-neutral, used by every model
generator). Each helper produces the right entry `type` —
`'operation'`, `'gqlOperation'`, or `'model'` — and the dispatcher in
`GenerateContext.toArtifacts` reads that to pick the right runtime
contract.

## Type-mapping rules

What the parser produces, by GraphQL kind:

| GraphQL | Becomes |
|---|---|
| `Int!` | `OasInteger` (`format: 'int32'`, `nullable: false`) |
| `Float!` | `OasNumber` (`format: 'float'`, `nullable: false`) |
| `String!` / `Boolean!` | `OasString` / `OasBoolean` |
| `ID!` | `OasString` with `format: 'id'` |
| Custom scalar `Foo!` | `OasString` with `format: 'Foo'` |
| `enum Role { A B }` | `OasString` with `enums: ['A', 'B']`, registered |
| `type User { ... }` | `OasObject` registered under `RefName('User')` |
| `input UserInput { ... }` | `OasObject` registered under `RefName('UserInput')` |
| `interface Node` | `OasObject` (base) **and** `OasUnion` over implementers as `RefName('NodeUnion')` |
| `union Result = A \| B` | `OasUnion` with `discriminator: { propertyName: '__typename' }` |
| `[T!]!` | `OasArray` (`nullable: false`, items not-null) |
| `[T!]` | `OasArray` (`nullable: true`, items not-null) |
| `[T]!` | `OasArray` (`nullable: false`, items nullable) |
| `[T]` | `OasArray` (`nullable: true`, items nullable) |
| `[[T!]!]!` (nested list) | `OasUnknown` — v1 limitation, see below |
| Reference to named type | `OasRef<'schema'>` via `registry.createRef(refName)` |
| Root field on Query/Mutation/Subscription | `GqlOperation` — args + returnType, **not** registered as a schema |

**Object vs Input duality.** GraphQL keeps these in disjoint name
spaces (`User` and `UserInput` are distinct), so the parser registers
both under their own names — no merging, no structural deduplication.

**Built-in scalars not registered.** `Int`, `Float`, `String`,
`Boolean`, `ID` are inlined at usage sites only; only **custom**
scalars produce a registry entry. This avoids polluting the registry
with names that aren't user-meaningful.

**Root types not registered.** `Query` / `Mutation` / `Subscription`
themselves are not emitted as schemas — their fields surface as
`GqlOperation` entries in `gqlDocument.operations`. Generators that
want to reference the root types use `gqlDocument.rootTypes`.

## Custom scalar mapping

The parser is intentionally **scalar-agnostic** — it just passes the
GraphQL scalar name through as `OasString.format`. Downstream
generators decide what TS / Zod / etc. type to emit based on the
format key.

In `gen-typescript`, configure via `toTypescriptEntry`:

```typescript
import { toTypescriptEntry } from '@skmtc/gen-typescript'

const typescript = toTypescriptEntry({
  scalars: {
    DateTime: 'string',
    JSON: 'Record<string, unknown>',
    BigInt: 'bigint'
  }
})
```

Unknown formats default to `unknown` (consistent with the survey
consensus across graphql-codegen / gql.tada / genql / etc.). Built-in
OpenAPI formats like `date-time`, `email`, `uuid` default to `string`.

## Pipeline integration

`SkmtcDocument` is the discriminated union at the protocol seam:

```typescript
type SkmtcDocument =
  | { type: 'oas'; value: OasDocument }
  | { type: 'gql'; value: GqlDocument }
```

The dispatch in `GenerateContext.toArtifacts`:
- Model generators run against either document — `GqlRegistry` and
  `OasComponents` both expose `toSchemasRefNames()` so the model
  dispatch is protocol-neutral.
- Operation generators run only against the matching protocol —
  HTTP entries (built with `toOperationEntry`, `type: 'operation'`)
  fire only against `{ type: 'oas' }` documents, GraphQL entries
  (built with `toGqlOperationEntry`, `type: 'gqlOperation'`) fire
  only against `{ type: 'gql' }` documents.
- Cross-type schema resolution (`context.resolveSchemaRefOnce`)
  discriminates on `document.type` to read from the right registry.

`CoreContext.toArtifacts` accepts a pre-built `SkmtcDocument`. The
two run-level entries own protocol-specific parsing:
- `run/toArtifacts.ts` (OAS) — calls `context.parse(documentObject)`,
  wraps as `{ type: 'oas', ... }`, passes to `CoreContext.toArtifacts`.
- `run/toArtifactsFromGraphQL.ts` (GraphQL) — calls `toGqlDocument`,
  wraps as `{ type: 'gql', ... }`, passes to `CoreContext.toArtifacts`.

## Why the parser lives in a sub-export

`@skmtc/core/parsers/graphql` is a deliberate sub-export. The parser
imports `graphql` (npm) for SDL parsing and `GraphQLSchema` access.
Consumers that only need the GraphQL data model — e.g., operation
generators that consume `GqlOperation` — should import from
`@skmtc/core` directly so they don't pull `graphql` into their
type-check graph.

Do not re-export the parser from the top-level `mod.ts`.

## Testing

Each entity has a unit test next to it. The end-to-end pipeline test
is at `core/parsers/graphql/integration.test.ts` — it parses an SDL,
constructs a `GenerateContext` with the resulting `GqlDocument`, runs
both a model generator and a `toGqlOperationEntry`-built operation
generator through the dispatcher, and asserts on the registered files.

Run from `core/`:

```bash
deno test --no-check --allow-env --allow-write --allow-read \
  gql/ parsers/graphql/ run/toArtifactsFromGraphQL.test.ts
```

A runnable end-to-end demo lives at
`skmtc-generators/gen-graphql-operation/demo/run.ts` — produces TS
output from `demo/blog.graphql` using `gen-typescript` +
`gen-graphql-operation`. Useful for inspecting actual generator output
when changing parser or generator behavior.

## Known limitations (v1)

- **Nested lists** (`[[T]]`) are not representable as a single
  `OasArray`. The parser detects them and produces `OasUnknown`.
  Generators that care could be extended later.
- **Directives** are dropped. Surface them as `extensionFields` if
  needed in v2.
- **Fragments / fragment masking** — not handled. Schema-driven
  generation only; document-driven (per-`.graphql` operation file with
  selection-set narrowing, à la graphql-codegen `typescript-operations`)
  is a deferred feature.
- **Subscriptions** — typed at the schema level, but no transport
  wiring is generated. Stream support is its own concern.
- **Federation** (`@key`, `@external`, etc.) — out of scope.

## Things to be careful about

- **Don't add `graphql` npm imports to non-parser files.** That npm
  package belongs strictly to `core/parsers/graphql/`. The data-model
  classes here are runtime-pure TypeScript with no SDL dependency.
- **Don't construct `OasRef` directly when parsing GraphQL.** Use
  `registry.createRef(refName)` so the ref resolves through the
  registry's mirror.
- **Object/Input duality is real.** A `User` (object) and `User`
  (input) with the same field set are still distinct in GraphQL; the
  parser registers both. Don't write code that assumes a single TS
  type per "logical" type.
- **Self-referential types are common in GraphQL** (`User { friends:
  [User!]! }`). Refs handle this fine; ensure model generators
  respect `context.modelDepth` to avoid unbounded recursion.


<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### May 5, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #18610 | 9:50 PM | ✅ | Created comprehensive CLAUDE.md documentation for GraphQL data model | ~762 |

### May 6, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #19047 | 4:20 PM | ✅ | Updated GraphQL Generator Documentation to Remove Obsolete Cast Pattern | ~458 |

### May 12, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #20770 | 11:44 AM | ✅ | Standardized codebase spelling from mixed UK/US English to consistent US English | ~605 |
</claude-mem-context>