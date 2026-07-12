# ParseContext

> The Parse-phase context. Owns the in-progress parsed document
> (discriminated by protocol), accumulates parse issues, tracks
> `$ref` consumers for cascade pruning, and exposes the issue-logging
> surface that parser code uses.

## Source

`skmtc/deno/core/context/ParseContext.ts`

## Class

```ts
class ParseContext {
  issues: ParseIssue[]
  logger: Logger
  silent: boolean
  protocol: ProtocolState                    // discriminated union

  #refConsumers: Map<string, StackTrail[]>   // private
  #refErrors: Map<string, unknown[]>         // private

  constructor(args: {
    input: SkmtcDocumentInput
    logger: Logger
    silent?: boolean
    options?: { gql?: GqlParseOptions }
  })

  // Parse-phase entry
  parse(stackTrail: StackTrail): SkmtcParsedDocument
  removeErroredItems(): void

  // Ref tracking
  registerRef(consumer: StackTrail, refKey: string): void
  registerRefError(error: unknown, refKey: string | undefined): void

  // Issue logging surface
  logIssueAt(issue: LogIssueAtArgs, parent?: unknown): void
  logIssue(args: LogIssueArgs): void
  logIssueNoKey(args: LogIssueNoKeyArgs): void
  log(args: LogAtArgs): void
  logSkippedFields(args: LogSkippedValuesArgs): void

  // Protocol-discriminated getters
  get oasDocument(): OasDocument             // OAS-only; throws on GQL
  get documentObject(): OpenAPIV3.Document   // OAS-only; throws on GQL
  get schema(): GraphQLSchema                // GQL-only; throws on OAS
  get registry(): GqlRegistry                // GQL-only; throws on OAS
  get gqlDocument(): GqlDocument             // GQL-only; throws on OAS
  get parsedDocument(): SkmtcParsedDocument  // either
}
```

## Constructor

```ts
new ParseContext({
  input: SkmtcDocumentInput,   // the discriminated document input
  logger: Logger,
  silent?: boolean,            // suppress logger output; default true
  options?: { gql?: GqlParseOptions }
})
```

The constructor sets up `protocol` based on `input.type`:

- For `{ type: 'oas', value: OpenAPIV3.Document }`: initializes
  `protocol` as `OasProtocolState` with an empty `OasDocument` ready
  to be populated.
- For `{ type: 'gql', value: GraphQLSchema | string }`: builds the
  schema (if string), initializes `protocol` as `GqlProtocolState`
  with an empty `GqlDocument` (the forward-reference target —
  populated by `parse()`).

Generators don't instantiate `ParseContext` — it's created
internally by `toArtifacts`.

## Properties

### `issues: ParseIssue[]`

The accumulating issue log. Per-item parse failures, type-inference
warnings, unexpected-property warnings — all end up here.

Each issue:

```ts
type ParseIssue = {
  protocol: 'oas' | 'gql'
  level: 'error' | 'warning'
  type: string              // see reference/error-codes.md
  location: string
  message: string
  cause?: unknown
}
```

After parse, the issues are written into the manifest's
`parseIssues` field.

### `logger: Logger`

Structured logger for trace-level output. Mirrored from
`logIssueAt` when `silent` is false.

### `silent: boolean`

When true, issue-logging methods don't echo to the logger — they
only accumulate into `issues`. When false, the logger receives each
issue as a warn-level structured event.

Default: true (suppress chatter; the manifest is the canonical
record).

### `protocol: ProtocolState`

Discriminated union. Either:

```ts
type OasProtocolState = {
  type: 'oas'
  documentObject: OpenAPIV3.Document
  oasDocument: OasDocument
}

type GqlProtocolState = {
  type: 'gql'
  schema: GraphQLSchema
  registry: GqlRegistry
  gqlDocument: GqlDocument
  options: GqlParseOptions
}
```

Most callers access protocol state through the typed getters
(`oasDocument`, `gqlDocument`, etc.) which throw on misroute.

### `#refConsumers: Map<string, StackTrail[]>` (private)

Inverse index: "who pointed at this ref?" Populated by `registerRef`
during the parse walk. Used by `removeErroredItems` to identify
which items to prune when their referenced schemas failed.

### `#refErrors: Map<string, unknown[]>` (private)

"What went wrong with this ref?" Populated by `registerRefError`
when a ref's target fails to parse. Cross-referenced with
`#refConsumers` during cascade pruning.

## Methods

### `parse(stackTrail: StackTrail): SkmtcParsedDocument`

The Parse-phase entry point. Walks the input document, builds the
parsed model, runs cascade pruning. Returns the discriminated
`SkmtcParsedDocument`.

Dispatches on `protocol.type`:

- **OAS**: calls `toDocumentFieldsV3` to populate
  `oasState.oasDocument.fields`, then `removeErroredItems`.
- **GQL**: calls `parseGqlDocument` to compute fields, populates
  the empty `gqlDocument` issued at construction, then
  `removeErroredItems`.

**Does not throw.** All parse-time failures become issues in the
`issues` array. Worst case: the returned document has fewer items
than the input.

### `removeErroredItems(): void`

The cascade-pruning step. Walks `#refErrors` and `#refConsumers`
together. For each failed ref, prunes every consumer from the
parsed document and logs an `INVALID_DEPENDENCY_REF` issue at the
consumer's location.

**Cascade depth: one hop.** Transitive consumers (consumers of
pruned items) aren't recursively pruned. They typically fail later
at generate time with `Ref "..." not found`.

### `registerRef(consumer: StackTrail, refKey: string): void`

Called by parser code when a `$ref` is encountered. Records the
consumer (via cloned stack trail) under the ref key.

```ts
// In core/oas/ref/toRefV31.ts:26
context.registerRef(stackTrail.clone(), $ref)
```

The `refKey` is typically the literal `$ref` string. The clone is
necessary because `StackTrail` is mutable; without cloning, the
stored value would change as the walk progresses.

### `registerRefError(error: unknown, refKey: string | undefined): void`

Called when a parse failure occurs at a component position. Stores
the error against the ref key. `undefined` `refKey` is a deliberate
no-op (used when the failure is at a non-component position).

Auto-called by `logIssueNoKey` for issues at component locations.
Parser code rarely calls this directly.

### `logIssueAt(issue: LogIssueAtArgs, parent?: unknown): void`

The universal issue recorder. Pushes to `issues`; mirrors to the
logger when `silent` is false.

```ts
type LogIssueAtArgs =
  | { protocol: 'oas', level: 'error', type: OasIssueType, location, message, cause? }
  | { protocol: 'oas', level: 'warning', type: OasIssueType, location, message }
  | { protocol: 'gql', level: 'error', type: GqlIssueType, location, message, cause? }
  | { protocol: 'gql', level: 'warning', type: GqlIssueType, location, message }
```

`parent` is optional context for the logger payload (stringified for
clone-safety) — not stored on the issue itself.

### `logIssue({ key, parent, type, stackTrail, ...issue }): void`

The OAS-flavored surface. Threads `key` through
`stackTrail.trace(key, st => ...)` to push a child trail, then
delegates to `logIssueNoKey`.

```ts
type LogIssueArgs = {
  key: string
  stackTrail: StackTrail
  parent?: unknown
  type: OasIssueType | GqlIssueType
  level: 'error'
  message: string
  cause?: unknown
} | {
  key: string
  stackTrail: StackTrail
  parent?: unknown
  type: OasIssueType | GqlIssueType
  level: 'warning'
  message: string
}
```

### `logIssueNoKey({ parent, type, stackTrail, ...issue }): void`

Like `logIssue` but without pushing a stack-trail key. Used when
the parser is already at the right depth.

Auto-registers `error`-level issues against the ref-key derivable
from the stack trail (via `StackTrail.toStackRef()`). This is what
makes cascade pruning work — error issues at component positions
automatically populate `#refErrors`.

### `log({ location, parent, type, ...issue }): void`

Convenience for logging an issue at a pre-computed string
location (e.g., a GraphQL `Query.fieldName` address). Constructs a
`StackTrail` from `location.split(':')` and delegates to
`logIssueNoKey`.

Useful when:

- The natural location isn't a tree position (e.g., schema-level
  directive definitions)
- The parser threw before producing an entity to attach to

### `logSkippedFields({ skipped, stackTrail, parent, parentType, type? }): void`

Records one warning per unrecognized key under `parent`. Each
skipped key is traced as a child of `stackTrail`.

`type` defaults to `UNEXPECTED_PROPERTY`. GQL callers may pass a
more specific category.

```ts
// Typical use in OAS parsers
const { foo, bar, baz, ...skipped } = obj  // skip known keys
context.logSkippedFields({
  skipped,
  parent: obj,
  parentType: 'SchemaObject',
  stackTrail
})
```

## Getters

The protocol-discriminated getters throw if accessed on the wrong
protocol. This is **deliberate** — parser code that uses these is
protocol-specific; a misroute is a real bug, not a recoverable
situation.

### `oasDocument`, `documentObject` (OAS-only)

```ts
get oasDocument(): OasDocument             // throws on GQL
get documentObject(): OpenAPIV3.Document   // throws on GQL
```

`oasDocument` is the in-progress parsed `OasDocument` instance.
`documentObject` is the raw input (the `OpenAPIV3.Document` JSON).

### `schema`, `registry`, `gqlDocument` (GQL-only)

```ts
get schema(): GraphQLSchema                // throws on OAS
get registry(): GqlRegistry                // throws on OAS
get gqlDocument(): GqlDocument             // throws on OAS
```

`schema` is the `graphql-js` parsed schema. `registry` is the
SKMTC-side registry of GQL types. `gqlDocument` is the in-progress
parsed `GqlDocument` (populated by `parse()`).

### `parsedDocument` (either)

```ts
get parsedDocument(): SkmtcParsedDocument
```

Discriminated wrapper for the current protocol's parsed document.
Used when constructing `OasRef`s (which need a document reference
for resolution).

## Examples

### Logging an issue from a parser

```ts
// In core/oas/schema/toObject.ts (example pattern)
function toObject({ value, stackTrail, context }) {
  if (!isValidObjectShape(value)) {
    context.logIssueNoKey({
      level: 'warning',
      stackTrail,
      parent: value,
      message: 'Schema has "properties" but is missing type="object"',
      type: 'MISSING_OBJECT_TYPE'
    })
    // ... proceed with inferred type
  }
}
```

### Registering a ref consumer

```ts
// In core/oas/ref/toRefV31.ts
export const toRefV31 = ({ ref, refType, stackTrail, context }) => {
  context.registerRef(stackTrail.clone(), ref.$ref)
  return new OasRef({ refType, $ref: ref.$ref }, context.parsedDocument)
}
```

The cloned stack trail captures *where* the ref was encountered.
After parse, cascade pruning uses these consumer trails to find
items to remove.

### Per-item isolation with tryParseAt

`tryParseAt` is the wrapper that catches per-item parse failures.
Generators don't write this directly — it's used by parsers like
`toSchemasV3`:

```ts
for (const [key, schema] of entries) {
  const value = tryParseAt({
    stackTrail, key, context,
    type: 'INVALID_SCHEMA',
    parent: schema,
    fn: st => toSchemaV3({ schema, stackTrail: st, context })
  })
  if (value !== undefined) output[key] = value
}
```

On throw, `tryParseAt` logs an error issue and returns undefined;
the offending entry is omitted from output.

## Common questions

### Why does `oasDocument` throw on GQL contexts?

To prevent misrouted parser code. OAS-specific parsers shouldn't
run on GQL contexts; if they do, the throw makes the bug visible
immediately. Returning `undefined` would let the parser proceed
into undefined-behavior territory.

### When is `gqlDocument` accessed during parse vs after?

During parse, `gqlDocument` is **empty** at construction time. The
empty instance is issued so `OasRef`s constructed during the walk
have a stable resolution target. `parse()` populates the empty
document at the end of the walk via
`gqlState.gqlDocument.fields = fields`.

After parse, the document is fully populated; refs resolve through
the now-filled registry.

This is the forward-reference resolution trick described in
[refs-and-resolution](../../concepts/refs-and-resolution.md#the-forward-ref-problem).

### Why does cascade pruning only go one hop?

Implementation complexity. Transitive pruning requires walking the
ref graph to a fixpoint, which is non-trivial (cycles, iteration
order, idempotency). Deferred. Transitive failures surface at
generate time as `Ref not found` exceptions, which the generator's
per-item try/catch handles gracefully.

### Can I log issues from generator code (not parser code)?

Generators have `context: GenerateContextType`, not
`ParseContextType`. The `GenerateContextType` doesn't expose the
issue-logging surface — parse issues are parse-phase only. If a
generator detects something wrong, the right move is to throw
(caught by `#runOasOperationGenerator`, mark the item as
`'error'`) rather than try to log a parseIssue.

### Why is `silent` true by default?

The manifest is the canonical record; logger output is for
debugging. Suppressing logger output by default keeps generation
quiet for the common case. Set `silent: false` when debugging
parser internals to see structured warn events as they happen.

## Related types

```ts
type SkmtcDocumentInput =
  | { type: 'oas', value: OpenAPIV3.Document }
  | { type: 'gql', value: GraphQLSchema | string }

type SkmtcParsedDocument =
  | { type: 'oas', value: OasDocument }
  | { type: 'gql', value: GqlDocument }

type GqlParseOptions = {
  includeIntrospection?: boolean
  // ... protocol-specific options
}
```

## See also

- [Error handling philosophy concept](../../concepts/error-handling-philosophy.md) — the two-tier model
- [Refs and resolution concept](../../concepts/refs-and-resolution.md) — how cascade pruning works
- [The three phases concept](../../concepts/the-three-phases.md) — pipeline context
- [Error codes reference](../error-codes.md) — parseIssue types
- [API: GenerateContext](generate-context.md) — what runs after ParseContext
- [Error codes](../error-codes.md) — every parseIssue type with its remediation
