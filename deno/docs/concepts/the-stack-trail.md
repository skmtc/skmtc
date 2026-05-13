# The StackTrail

> The mutable position-stack threaded through Parse: how a single
> object simultaneously tracks "where the walker currently is",
> produces issue locations for the manifest, and bridges between
> tree positions and OAS `$ref` strings so cascade pruning works
> without per-parser bookkeeping.

`StackTrail` is a small class (`core/context/StackTrail.ts`, ~240
lines) but it is one of the most load-bearing pieces of the Parse
phase. Three responsibilities pile onto it:

1. **Locate** — every `ParseIssue` carries a `location` string, and
   that string is the `toString()` of a `StackTrail`.
2. **Address** — when a parser hits a `$ref`, the trail at that
   point is what cascade pruning will later use to find the
   consumer to remove.
3. **Bridge** — `toStackRef()` converts a component-position trail
   into the OAS `$ref` form, so errors logged at component
   positions can be matched against the literal `$ref` strings
   used by their consumers.

This page explains the mechanics. For *why* the cascade-pruning
model exists at all, see
[error-handling-philosophy.md](error-handling-philosophy.md). For
how refs themselves work, see [refs-and-resolution.md](refs-and-resolution.md).

## The one-line definition

A `StackTrail` is a mutable, ordered list of string frames
representing the path from the document root to the parser's
current position. Frames are pushed as the walker descends, popped
as it returns. Stringified with `:` as the separator, it becomes
the `location` of any issue logged at that point.

## Frame structure

A trail is just a sequence of strings:

```ts
// core/context/StackTrail.ts:3-9
export class StackTrail {
  #stack: string[]
  constructor(stack: string[] = []) {
    this.#stack = stack
  }
  // ...
}
```

Typical trails during an OAS walk:

- `['components', 'schemas', 'User']` — at the `User` schema
- `['paths', '/users', 'post', 'requestBody', 'content',
  'application/json', 'schema']` — inside the POST `/users` request
  body schema
- `['paths', '/users', 'get', 'parameters', '0']` — at the first
  parameter of GET `/users`

There is no per-frame metadata — no "kind" tag, no parent
pointer. Just strings. The frames *are* the path.

## Why mutable

A natural alternative would be a persistent (immutable) list with
structural sharing. SKMTC's design is the opposite: one mutable
trail walks the whole document, mutating in place as it descends
and returns.

Reasons:

1. **Performance over a deep, frequently-recursed walk.** OAS
   documents nest deeply (`paths.<path>.<method>.requestBody.content.<mediaType>.schema.properties.<key>.items...`).
   A persistent list would allocate a new cons cell per descent.
   The mutable variant allocates once and reuses.
2. **The walk's natural shape is stack-like.** Recursive descent
   pushes and pops in nesting order. A mutable stack matches that
   shape exactly.
3. **Snapshots are explicit.** When storage outlives the walk
   position (registering a ref consumer, logging an issue
   asynchronously), the caller `clone()`s explicitly. The cost is
   visible in the source.

The tradeoff is that any code that *holds onto* a trail across the
walker's return must clone first. Two places in the codebase do
this; both call `clone()` explicitly. See
"[The clone-on-store rule](#the-clone-on-store-rule)" below.

## `trace(key, fn)` — the scoped-descent primitive

Every parser uses `trace` to descend into a child:

```ts
// core/context/StackTrail.ts:84-98
trace<T>(key: string, fn: (st: StackTrail) => T): T {
  const stackTrail = this.clone()
  stackTrail.append(key)
  try {
    const result = fn(stackTrail)
    stackTrail.remove(key)
    return result
  } catch (error) {
    stackTrail.remove(key)
    throw error
  }
}
```

Four design choices, each load-bearing:

### Clone before mutating

`trace` clones the caller's trail first. The child callback
receives the clone with `key` appended; the caller's trail is
untouched. Without the clone, sibling traces at the same level
would observe each other's pushed frames as transient state.

Concretely: a parser at `['components', 'schemas']` calling
`stackTrail.trace('User', ...)` twice (perhaps recursively for
some reason) would see the second call's trail include
leftover state from the first if no clone happened.

### Pop on both success and exception

The `remove(key)` call runs in both the `try` and `catch` branches.
If `fn` throws, the trail still gets restored before the throw
propagates. Combined with the clone-first step, this means a
thrown error inside `fn` cannot leave dangling frames on either
the caller's trail (untouched) or the clone (popped).

### Defensive assertion on `remove`

```ts
// core/context/StackTrail.ts:179-188
remove(frame: string | string[]): StackTrail {
  if (typeof frame === 'string') {
    const lastItem = this.#stack.pop()
    if (lastItem !== frame) {
      throw new Error(
        `Expected to remove frame '${frame}' but found '${lastItem}'`
      )
    }
    return this
  }
  // ...
}
```

`remove` asserts that the popped frame matches the expected one.
If a parser logic bug pushed something else in between (a missing
nested pop, a misordered call), the assertion fires loudly rather
than silently producing wrong locations on later issues. The check
costs one string comparison per pop and catches a whole class of
quiet bugs.

### `traceAsync` mirrors the same pattern

The async version is identical except for `await fn(stackTrail)`.
There is no shared mutable state between concurrent traces because
each `trace` call clones up front — but in practice the parser is
single-threaded synchronous within a walk, and the async surface
exists for symmetry with caller types.

## The clone-on-store rule

Two places store a trail beyond the walker's lifetime:

### Ref-consumer registration

When a parser encounters a `$ref`, it calls `registerRef` to record
"this position pointed at that ref":

```ts
// core/oas/ref/toRefV31.ts:26
context.registerRef(stackTrail.clone(), $ref)
```

Without the `.clone()`, the stored trail would change as the walk
returned through the parent frames. By the time
`removeErroredItems` ran at end-of-parse, every stored "consumer"
would be the same shared trail mutated to whatever position the
walker happened to finish at.

### Pre-computed location for `log`

`ParseContext.log({ location: 'A:B:C' })` reconstructs a trail
from a string and runs it through `logIssueNoKey`. This path
doesn't share state with the walker, so cloning isn't needed — but
it's the inverse operation: trail-from-string instead of
string-from-trail. See "[Round-trip with `log({ location })`](#round-trip-with-log-location)".

## `toString()` — colons, with `%3A` escape

```ts
// core/context/StackTrail.ts:236-242
toString(): string {
  return this.#stack
    .map(item => item.replaceAll(':', '%3A'))
    .join(':')
}
```

Frames join with `:`. Any literal colon inside a frame is
URL-encoded as `%3A` so the separator stays unambiguous.

In practice the escape rarely fires — OAS path segments include
`/`, GraphQL identifiers don't carry colons, etc. — but the
encoding rule exists so a `location` string in the manifest is
always parseable by `split(':')` into the same number of segments
the original trail had.

The output of `toString()` is what every `ParseIssue.location`
field carries. It is the surface tool authors see when reading
the manifest.

## `toStackRef()` — the address bridge

Trails and OAS `$ref` strings address overlapping spaces using
different syntaxes:

| Address | Example |
|---|---|
| Trail | `['components', 'schemas', 'User']` |
| `$ref` | `#/components/schemas/User` |

`toStackRef` converts a trail to its `$ref` form *if* the trail
points at an OAS component:

```ts
// core/context/StackTrail.ts:138-154
toStackRef(): string | undefined {
  const [first, second, third] = this.stackTrail
  if (first !== 'components') return
  if (typeof second !== 'string' || !componentsKeys.includes(second)) return
  if (typeof third !== 'string') return
  return `#/${first}/${second}/${third}`
}
```

Three conditions must hold:

1. The first frame is `'components'`.
2. The second frame is a recognized component bucket
   (`schemas`, `parameters`, `responses`, etc.).
3. The third frame exists (the component's name).

If any condition fails, the result is `undefined`. Trails at path
positions (`paths./users.post...`), GraphQL trails, or trails
shallower than three frames all return `undefined`.

This `undefined` is **not** an error. It composes with
`ParseContext.registerRefError`:

```ts
// core/context/ParseContext.ts:334-342
registerRefError(error: unknown, refKey: string | undefined): void {
  if (!refKey) return        // ← deliberate no-op on undefined
  // ...
}
```

`registerRefError` is a no-op when `refKey` is `undefined`. So
combining the two: any code that says "register a ref error at
the trail's current `$ref` form" *automatically* filters to
component-position errors and silently ignores everything else.

This is what `logIssueNoKey` does for every error-level issue:

```ts
// core/context/ParseContext.ts:399
this.registerRefError(issue.cause ?? issue.message, stackTrail.toStackRef())
```

Parser code never has to check "am I at a component position right
now?" — the trail shape decides, and non-component positions fall
through without consequence.

The bridge is what makes cascade pruning work without per-parser
bookkeeping. See
[error-handling-philosophy.md](error-handling-philosophy.md#tier-2-cross-ref-via-removeerroreditems)
for the pruning algorithm itself.

## `removeItem` reads only the first three segments

When cascade pruning runs, each consumer trail is handed to
`OasDocument.removeItem`. The trail can be arbitrarily deep —
wherever the parser was when it hit the `$ref` — but `removeItem`
looks at only the first three segments:

```ts
// core/oas/document/Document.ts:190-219
removeItem(stackTrail: StackTrail): OasOperation | OasSchema | OasRef<'schema'> | undefined {
  const [first, second, third] = stackTrail.stackTrail
  switch (first) {
    case 'paths': {
      const index = this.#fields!.operations.findIndex(
        ({ path, method }) => path === second && method === third
      )
      // ... splice and return
    }
    case 'components': {
      return this.#fields!.components!.removeSchema(third as RefName)
    }
    default:
      throw new Error(`Unexpected stack trail: ${stackTrail}`)
  }
}
```

So a consumer trail like `paths./users.post.requestBody.content.application/json.schema`
prunes the whole `POST /users` operation. The deeper segments are
discarded.

This works because OAS operations are atomic at the pruning level:
there's no useful "remove just this part of the request body" —
either the whole operation parses or the whole operation gets
pruned. Same for components: a component fails to parse, the
component is removed; finer-grained removal isn't a coherent
concept.

The granularity is by design, not omission.

## Composition with `tryParseAt` — the error-path re-trace

`tryParseAt` is the per-item-isolation helper used by `toSchemasV3`,
`toParameterV3`, `toResponseV3`, and the GraphQL parser. It runs
its callback inside `stackTrail.trace(key, ...)`. On throw, it
re-enters the trace to log the error at the child position:

```ts
// core/context/tryParseAt.ts:81-99
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

The re-trace is not a stylistic quirk. By the time the `catch`
block runs, the original `trace` has already popped `key` from
the trail (that's the "pop on both success and exception"
behavior). The trail is back at the parent level. To log the
error at the *child* position — which is the natural location for
"parsing this item failed" — `tryParseAt` opens a fresh trace
with the same key.

Removing the re-trace would log the error at the parent
location, which would make every per-item failure look like it
happened to its container instead of the offending item. The
re-trace is what gives `INVALID_SCHEMA` issues a location like
`components:schemas:User` instead of `components:schemas`.

## Round-trip with `log({ location })`

The inverse operation — building a trail from a string — exists
in `ParseContext.log`:

```ts
// core/context/ParseContext.ts:451-454
log({ location, parent, type, ...issue }: LogAtArgs): void {
  const stackTrail = new StackTrail(location.split(':'))
  this.logIssueNoKey({ stackTrail, parent, type, ...issue })
}
```

Two notes on the round-trip:

1. **`split(':')` doesn't decode `%3A`.** A frame that originally
   contained `:` will round-trip as a frame containing `%3A`. The
   `location` string is consistent, but a single segment that
   originally had a colon stays URL-encoded after reconstruction.
2. **`log` is for callers without a live walker.** GraphQL
   schema-level directive definitions (no tree position), and
   any catch-all error path where the parsed entity doesn't exist
   yet (the parse threw before producing it). Tree-position
   issues use `logIssueNoKey` instead, which keeps the trail
   composable with surrounding traces.

## Where trails come from

Trails are created in two places:

1. **At the top of `parse(stackTrail)`** — `toArtifacts` (or test
   code) constructs an empty `StackTrail()` and passes it in. This
   is the root. Every nested trace descends from it.
2. **By `log({ location })`** — reconstructed from a string for
   issues whose natural address isn't a tree position.

Nothing else needs to instantiate a trail. Parsers receive one
from their caller and pass children of it via `trace`.

## Common questions

### Why not use an array of objects (richer frame metadata)?

A frame could be `{ kind: 'pathItem', key: '/users' }` instead of
`'/users'`. The richer shape would let `toStackRef` and
`removeItem` dispatch on `kind` instead of position-based pattern
matching.

The current design chose simplicity: a frame is a string, and the
semantics of position N is "whatever the parser at that depth
considers meaningful." `toStackRef` and `removeItem` happen to
look at the first three positions because OAS component
addressing is three-deep, but no general invariant is enforced —
the design relies on parsers being consistent about what they
push.

If a future change makes per-frame semantics more complex (e.g.,
distinguishing `'0'` as an array index vs object key), a richer
frame shape would be the right move. Today, strings are enough.

### Can I synthesize a trail outside the walker?

Yes — `new StackTrail(['components', 'schemas', 'Foo'])` is
valid. Test fixtures use this. Production code rarely needs to.

### Does GraphQL use StackTrail?

Yes, but less. The GraphQL parser also receives a `StackTrail` and
uses it for `tryParseAt`-based per-type isolation. But GraphQL's
natural addresses (`Query.fieldName.argument.0`) are schema-level,
not tree-position. The GQL-flavored issue surface uses
`ParseContext.log({ location })` with a pre-computed string for
those, rather than building them via `trace`. So GQL pays for the
trail mechanism but uses less of it.

### Why does `toStackRef` hardcode three positions?

OAS component addresses are exactly three-deep:
`#/components/<bucket>/<name>`. There is no four-deep ref. The
function shape matches the spec shape.

If OAS ever introduced four-deep refs (it won't), the function
would generalize. The current shape is "do the simple thing for
the only case that exists."

### What if I want to attach extra info to an issue?

`logIssueAt` accepts an optional `parent` argument. It's
JSON-stringified for the logger payload but is **not** stored on
the persisted `ParseIssue` (the `cause` field is the only
non-trail context that survives to the manifest). The rationale
is keeping the manifest serializable across the worker boundary
and bounded in size.

### Is the StackTrail visible to generator code?

Indirectly. Issue `location` strings appear in the manifest's
`parseIssues` array, which generators don't typically read.
Generators that want to know "where did this parsed item come
from" use the OAS object model (`operation.path`,
`schema.refName`) rather than reconstructing a trail.

## Further reading

- [Error handling philosophy](error-handling-philosophy.md) — the
  cascade-pruning model that uses `toStackRef` + `registerRef` +
  `removeItem`
- [Refs and resolution](refs-and-resolution.md) — the partner
  concept; ref-string addressing and lazy resolution
- [The three phases](the-three-phases.md) — where Parse sits in
  the pipeline
- [API reference: ParseContext](../reference/api/parse-context.md)
  — the issue-logging surface that builds on StackTrail
- [Reference: error codes](../reference/error-codes.md) — the
  `ParseIssue.type` values that appear with `location` strings
- [Reference: manifest format](../reference/manifest-format.md) —
  where `location` strings end up
