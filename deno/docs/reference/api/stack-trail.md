# StackTrail

> A mutable, ordered stack of string frames representing the
> parser's current position in the input document. Threaded through
> Parse for issue location, ref-consumer addressing, and the bridge
> to OAS `$ref` strings.

For the design rationale and the patterns that compose around this
class, see [the-stack-trail.md](../../concepts/the-stack-trail.md).
This page is the API-level reference.

## Source

`skmtc/deno/core/context/StackTrail.ts`

## Class

```ts
class StackTrail {
  constructor(stack?: string[])

  get stackTrail(): string[]

  // Mutation
  append(frame: string | string[]): StackTrail
  remove(frame: string | string[]): StackTrail

  // Scoped descent
  trace<T>(key: string, fn: (st: StackTrail) => T): T
  traceAsync<T>(key: string, fn: (st: StackTrail) => Promise<T>): Promise<T>

  // Snapshots and conversions
  clone(): StackTrail
  toString(): string
  toJSON(): string
  toStackRef(): string | undefined
}
```

## Constructor

```ts
new StackTrail(stack: string[] = [])
```

Initializes a trail with the given frames. The argument is stored
by reference (no defensive copy) — typical use is either no
argument (empty trail) or `location.split(':')` (reconstruction
from a manifest location string).

Tests and the `parse(stackTrail)` entry point construct the root
trail. Parser code receives a trail from its caller and produces
children via `trace`; it does not call the constructor directly.

## Properties

### `stackTrail: string[]`

Read access to the underlying frame array. Returns the live
array, not a copy — mutating the returned array mutates the
trail. The getter exists for inspection (e.g.
`OasDocument.removeItem` destructures `[first, second, third]`),
not as a public mutation surface.

## Methods

### `append(frame): StackTrail`

```ts
append(frame: string | string[]): StackTrail
```

Pushes one or more frames to the end of the trail. Returns
`this` for chaining. Throws on inputs that are neither string nor
string array.

Most parser code uses `trace` rather than calling `append`
directly — `trace` handles the matching `remove` automatically.

### `remove(frame): StackTrail`

```ts
remove(frame: string | string[]): StackTrail
```

Pops the last frame(s). The popped frame **must match** the
argument; if the actual top differs, throws
`Expected to remove frame '<arg>' but found '<actual>'`.

The assertion is defensive — it catches logic bugs where a
parser pushed a frame without a matching pop, or popped in the
wrong order. For arrays, frames are removed in reverse order
(the last frame in the array pops first).

### `trace(key, fn): T`

```ts
trace<T>(key: string, fn: (st: StackTrail) => T): T
```

Descends into a child position. Internally:

1. Clones the trail (`this.clone()`).
2. Appends `key` to the clone.
3. Runs `fn(clone)`.
4. Removes `key` from the clone (whether `fn` returned or threw).
5. Re-throws any error from `fn`.

The caller's trail is never mutated. The clone is what `fn`
receives, and the clone is what gets restored. This is the
primary scoped-descent primitive used throughout parser code.

Important properties:

- The frame is popped on both the success and exception paths.
- The assertion in `remove` runs on both paths, so a parser that
  pushes extra frames without matching pops will fail loudly
  whether or not it threw.
- Multiple `trace` calls at the same level are independent (each
  clones from the parent).

### `traceAsync(key, fn): Promise<T>`

```ts
traceAsync<T>(
  key: string,
  fn: (st: StackTrail) => Promise<T>
): Promise<T>
```

Async version of `trace`. Identical semantics with `await fn(...)`.

Provided for symmetry with caller types; the OAS parser is
synchronous and does not currently call `traceAsync` in the main
path. The GraphQL parser uses sync `trace`.

### `clone(): StackTrail`

```ts
clone(): StackTrail
```

Returns a new `StackTrail` whose internal frame array is a shallow
copy of this trail's. Strings are immutable, so the result is
fully independent.

Two production call sites use `clone` outside of `trace`:

- `registerRef` storage: `context.registerRef(stackTrail.clone(), $ref)`
  (`core/oas/ref/toRefV31.ts:26`). Without the clone, the stored
  consumer trail would mutate as the walker returned.
- Test fixtures and the rare parser that needs to snapshot a trail
  for deferred logging.

### `toString(): string`

```ts
toString(): string
```

Returns the frames joined by `:`. Any literal `:` inside a frame
is URL-encoded as `%3A` to keep the separator unambiguous.

The output is what every `ParseIssue.location` carries. Manifest
readers can `split(':')` to recover segment boundaries; embedded
colons remain encoded (`%3A`).

### `toJSON(): string`

```ts
toJSON(): string
```

Returns the same as `toString()`. Hook for `JSON.stringify` —
trails serialize to strings, not arrays, when embedded in JSON
payloads.

### `toStackRef(): string | undefined`

```ts
toStackRef(): string | undefined
```

Returns the OAS-style `$ref` string for trails of shape
`['components', <known-bucket>, <name>]`. Returns `undefined`
otherwise.

```ts
new StackTrail(['components', 'schemas', 'User']).toStackRef()
// → '#/components/schemas/User'

new StackTrail(['paths', '/users', 'post']).toStackRef()
// → undefined

new StackTrail(['components', 'schemas']).toStackRef()
// → undefined  (missing third frame)
```

Recognized buckets are exactly those in `Components.componentsKeys`
(`schemas`, `parameters`, `responses`, `requestBodies`, `headers`,
`examples`, `securitySchemes`).

This function is the address bridge used by `ParseContext.logIssueNoKey`
to auto-populate `#refErrors`. Combined with
`ParseContext.registerRefError`'s no-op-on-`undefined` behavior,
the result is that errors at component positions feed cascade
pruning while errors elsewhere stay scoped to the issue log. See
[the-stack-trail.md](../../concepts/the-stack-trail.md#tostackref-the-address-bridge).

## Examples

### Typical parser usage

```ts
// Inside a recursive parser
export const toSomeFieldsV3 = ({
  fields, stackTrail, context
}: { fields: Record<string, unknown>, stackTrail: StackTrail, context: ParseContextType }) => {
  for (const [key, value] of Object.entries(fields)) {
    stackTrail.trace(key, childStack => {
      // childStack is `stackTrail` plus the `key` frame
      // ... parse `value` using childStack
    })
    // After trace returns, stackTrail is back at the parent level
  }
}
```

### Reconstructing a trail from a location string

```ts
// Inside ParseContext.log
const stackTrail = new StackTrail(location.split(':'))
```

This is the inverse operation of `toString()`. Used when the
natural address for an issue isn't a tree position — e.g., a
GraphQL `Query.fieldName.return` schema-level address.

Note: `split(':')` does not decode `%3A`, so frames that
originally contained literal colons round-trip as frames
containing `%3A` literals.

### Snapshotting for deferred use

```ts
// core/oas/ref/toRefV31.ts:26
context.registerRef(stackTrail.clone(), $ref)
```

The walker continues after this call, popping `$ref`'s parent
frames. Without `clone`, the stored "consumer" trail would
mutate. With `clone`, the consumer trail captures the position at
the ref encounter site.

## Composition with `tryParseAt`

The `tryParseAt` helper (`core/context/tryParseAt.ts`) uses
`trace` for both the success path and the error path — the latter
re-enters a fresh trace to log the error at the child position:

```ts
try {
  return stackTrail.trace(key, childStack => fn(childStack))
} catch (error) {
  // ...
  stackTrail.trace(key, childStack => {
    context.logIssueNoKey({
      level: 'error',
      stackTrail: childStack,
      // ...
    })
  })
  return undefined
}
```

The re-trace is necessary because the original `trace` pops `key`
on the exception path. Without re-tracing, the error would log at
the parent's location instead of the failing item's.

## Composition with `OasDocument.removeItem`

`OasDocument.removeItem(stackTrail)` reads only the first three
frames of the trail
(`core/oas/document/Document.ts:190-219`):

- `['paths', '<path>', '<method>', ...]` → removes the operation
  matching `(path, method)`; deeper frames are discarded.
- `['components', '<bucket>', '<name>', ...]` → removes the named
  component from the bucket; deeper frames are discarded.
- Anything else → throws `Unexpected stack trail: ...`.

Cascade pruning passes deeply-nested consumer trails (wherever
the `$ref` was encountered) to `removeItem`; the granularity is
operation- or component-level by design.

## Common gotchas

| Gotcha | What happens | What to do |
|---|---|---|
| Forgetting to `clone()` before storing | Stored trail mutates as walker returns | Always clone trails that outlive the walker's current frame |
| Manual `append` without matching `remove` | `remove` assertion fires later | Use `trace` for scoped descent |
| Popping in wrong order | `remove` assertion fires with mismatched frame | Match every `append` with a `remove` in the same scope |
| Reading `toStackRef()` and skipping the `undefined` check | Confusion when non-component trails yield no ref | Pair `toStackRef()` with the no-op-on-`undefined` consumer (e.g. `registerRefError`) |
| Calling `removeItem` on a trail that doesn't start with `paths` or `components` | Throws "Unexpected stack trail" | Only consumer trails for `$ref` cascade pruning reach `removeItem`; trails at other positions don't |

## See also

- [Concept: the StackTrail](../../concepts/the-stack-trail.md) — the design rationale
- [Concept: error handling philosophy](../../concepts/error-handling-philosophy.md) — the cascade-pruning algorithm that uses trails as addresses
- [Concept: refs and resolution](../../concepts/refs-and-resolution.md) — the partner concept (ref-string addressing)
- [API: ParseContext](parse-context.md) — the issue-logging surface that builds on trails
- [API: OAS document model](oas-document-model.md) — `removeItem` and the parsed document
- [Reference: manifest format](../manifest-format.md) — where `toString()` output appears
- [Reference: error codes](../error-codes.md) — `ParseIssue.type` values
