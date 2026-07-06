# Error handling philosophy

> Why parse fails open and the manifest is the canonical run record: SKMTC
> treats partial output with full diagnostics as more valuable than zero output
> with a single root-cause error. One bad schema shouldn't kill the run.

The philosophy in one sentence: **lenient input, strict diagnostics**.

Many codegen tools fail closed — one parse error halts everything, forcing the
user to fix the schema before getting any output. SKMTC fails open: it parses
what it can, prunes what it can't, logs every decision, and produces output for
the surviving items. The manifest is the structured record of what worked and
what didn't.

This isn't anything-goes leniency. Diagnostics are exhaustive; every dropped
item, every cascading failure, every type-inference fallback is logged with
location and reason. The user gets both the output they could have _and_ full
visibility into what was sacrificed.

## The one-line definition

Parse never throws to its caller. Generator transforms catch errors per item.
The manifest records every outcome. Exit codes are derived from the manifest,
not from process throws.

## Two-tier error isolation in Parse

Parse uses two complementary mechanisms to ensure one bad item doesn't kill the
run.

### Tier 1: per-item isolation via `tryParseAt`

Every per-item parser is wrapped in `tryParseAt`:

```ts
// core/oas/schema/toSchemasV3.ts
for (const [key, schema] of entries) {
  const value = tryParseAt({
    stackTrail,
    key,
    context,
    type: "INVALID_SCHEMA",
    parent: schema,
    fn: (st) => toSchemaV3({ schema, stackTrail: st, context }),
  });
  if (value !== undefined) {
    output[key] = value;
  }
  // ← if value is undefined, the entry is silently omitted from output
}
```

A throw inside `toSchemaV3` becomes a `level: 'error'` `ParseIssue`, and the key
is skipped in the output map. The siblings continue parsing. The error stays in
the issue log with full stack-trail location.

This is **per-item** isolation. The unit can be one schema, one operation, one
parameter — whatever the level the `tryParseAt` wraps.

### Tier 2: cross-ref via `removeErroredItems`

What happens when a parsed item references a _failed_ item via `$ref`?

During the parse walk, every `$ref` encounter calls
`context.registerRef(stackTrail.clone(), $ref)`. This builds a map:
`#refConsumers: Map<refKey, StackTrail[]>` — "who pointed at this ref?"

When a parse error happens at a component position, `logIssueNoKey`
auto-registers the error against the ref by calling
`context.registerRefError(issue.cause, stackTrail.toStackRef())`. This builds:
`#refErrors: Map<refKey, unknown[]>` — "what went wrong with this ref?"

After the main walk finishes, `removeErroredItems` walks both maps together:

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

So if `User` fails to parse and `CreateUserRequest.parameters[0]` referenced
`User`, that operation gets pruned from `oasDocument.operations`, with an
`INVALID_DEPENDENCY_REF` issue at the operation's location explaining why.

The cascade is **one hop deep** by current design. If `Post` references `User`
and `Comment` references `Post`, breaking `User` prunes `Post` (one hop).
`Comment` would then fail later when it tries to resolve a now-missing `Post` —
but that failure happens at generate time, not in `removeErroredItems`.

## How the mechanism is engineered

The high-level model (parse fails open, refs are cloned, cascade prunes
consumers one hop) rests on four small implementation choices, each easy to
overlook on a casual read. None of them are load-bearing in isolation; together
they are what makes the model true rather than aspirational.

### 1. Empty parsed document issued at construction, mutated in place

`ParseContext` constructs an empty `OasDocument` _before_ the walk starts
(`core/context/ParseContext.ts:120`). Every `OasRef` constructed during the walk
holds a reference to `context.parsedDocument`, which wraps that same instance:

```ts
// core/oas/ref/toRefV31.ts:26-34
context.registerRef(stackTrail.clone(), $ref);
return new OasRef({ refType, $ref }, context.parsedDocument);
```

`OasDocument.#fields` is `undefined` at this point — every getter throws
(`Document.ts:248`: `Accessing 'openapi' before fields are
set`). At the end of
parse, `parse()` mutates the same instance via
`oasState.oasDocument.fields = toDocumentFieldsV3(...)`. All the refs that
captured the empty wrapper now resolve through the now-populated fields.

The same pattern is applied to `GqlDocument` (`ParseContext.ts:134-136`). Issued
empty at construction, populated by `parseGqlDocument` at the end of the walk.
The symmetry is deliberate.

Without this pattern, lazy ref resolution would require either two passes (parse
all schemas first, then resolve refs) or strict topological ordering of
components in the source document. The issued-empty-then-mutated trick avoids
both.

### 2. The `toStackRef` + `registerRefError` no-op composition

`StackTrail.toStackRef()` returns a `$ref` string _only_ when the trail points
at a recognized component position (`['components', <bucket>, <name>]`) — and
returns `undefined` otherwise (`StackTrail.ts:138-154`).

`ParseContext.registerRefError` is a deliberate no-op on `undefined`:

```ts
// core/context/ParseContext.ts:334-342
registerRefError(error: unknown, refKey: string | undefined): void {
  if (!refKey) return
  // ...
}
```

The two compose. Inside `logIssueNoKey`, every error-level issue runs:

```ts
// core/context/ParseContext.ts:399
this.registerRefError(issue.cause ?? issue.message, stackTrail.toStackRef());
```

Parser code never has to know whether it's at a component position. The trail
shape decides; non-component errors fall through silently. This is the bridge
between two different addressing schemes — tree positions (held by trails) and
`$ref` strings (used by consumers). Every component-position error automatically
becomes eligible for cascade pruning; every other error stays in the issue log
but doesn't fan out.

See [the-stack-trail.md](the-stack-trail.md#tostackref-the-address-bridge) for
the full address-bridge story.

### 3. `removeItem` reads only the first three trail segments

When cascade pruning runs, each stored consumer trail is passed to
`OasDocument.removeItem`. The trail can be arbitrarily deep — wherever the
parser was when it hit the `$ref` — but `removeItem` only looks at
`[first, second, third]`:

```ts
// core/oas/document/Document.ts:190-219
case 'paths': {
  const index = this.#fields!.operations.findIndex(
    ({ path, method }) => path === second && method === third
  )
  // ... splice and return
}
case 'components': {
  return this.#fields!.components!.removeSchema(third as RefName)
}
```

So a deeply-nested consumer trail like
`paths./users.post.requestBody.content.application/json.schema` prunes the whole
`POST /users` operation. The deeper segments are discarded.

The granularity is by design: OAS operations and components are atomic at the
pruning level. There is no useful "remove the request body schema but keep the
rest of the operation" — either the operation parses or it gets pruned. The same
is true for components.

### 4. `tryParseAt` re-enters `stackTrail.trace` on the error path

`tryParseAt` runs its callback inside `stackTrail.trace(key, ...)`. By the time
a thrown error reaches the surrounding `catch`, the trace has already popped
`key` from the trail (that's `trace`'s pop-on-both-paths guarantee). To log the
error at the _child_ position, `tryParseAt` opens a fresh trace:

```ts
// core/context/tryParseAt.ts:81-99
try {
  return stackTrail.trace(key, (childStack) => fn(childStack));
} catch (error) {
  // ...
  stackTrail.trace(key, (childStack) => {
    context.logIssueNoKey({
      level: "error",
      stackTrail: childStack,
      // ...
    });
  });
  return undefined;
}
```

Without the re-trace, the error would log at the _parent_ location, and every
per-item failure would point at its container instead of the offending item.
With the re-trace, `INVALID_SCHEMA` issues land at `components:schemas:User`
instead of `components:schemas`.

This is also why issues stay accurately located even though the trail itself is
mutable and shared across the walker.

## Why one-hop cascade pruning?

The honest answer: depth-2+ pruning was deferred. Implementing it robustly
requires walking the ref graph transitively, which is non-trivial because:

- The ref graph can have cycles (handled by `MAX_LOOKUPS` at resolution time,
  but graph walking needs its own cycle protection)
- A single ref can be referenced by many consumers; ordering matters
- Removing items can trigger their own cascades — the algorithm becomes
  iterative-to-fixpoint

In practice, depth-2 failures show up at generate time as `Ref "Post" not found`
exceptions in generator code. The generator's own `try/catch` handles these
gracefully (the operation is marked `'error'` in the manifest results). The user
sees the chain in the manifest: `User` is `INVALID_SCHEMA`, `Post` is
`INVALID_DEPENDENCY_REF`, `Comment` operations are individually marked `'error'`
with `Ref "Post" not found` as the message.

Imperfect but acceptable. The manifest still records everything.

## Type-inference fallbacks (the other lenient lever)

OAS documents in the wild often omit `type` on schemas — the JSON Schema spec
made it optional. SKMTC infers when it can rather than failing:

- Schema has `properties` → assume `type: 'object'`. Logs a
  `MISSING_OBJECT_TYPE` warning.
- Schema has `items` → assume `type: 'array'`. Logs `MISSING_ARRAY_TYPE`.
- Schema has `default` or `example` that's a string → assume `type: 'string'`.
  Logs `MISSING_STRING_TYPE`.
- Schema has a recognized string `format` (`date`, `date-time`, etc.) → assume
  `type: 'string'`. Logs `MISSING_STRING_TYPE`.

These are **warnings**, not errors. The output is produced; the warning is
logged. A consumer reviewing the manifest sees both: "I got my types" and "by
the way, three of your schemas were missing `type` fields and I inferred them —
you might want to fix the source."

This is the leniency-strictness pairing in action. Lenient on input (we don't
refuse to parse), strict on diagnostics (we log every inference).

## The manifest as canonical run record

The manifest at `<root>/.skmtc/<project>/.settings/manifest.json` is the
**source of truth** for what happened in the last run. The on-screen output
reports a summary; the manifest reports every decision.

### Top-level structure

```ts
{
  deploymentId: string         // identifies the run
  traceId, spanId: string      // log correlation
  startAt, endAt: number       // unix-ms; (endAt - startAt) = wall time
  files: Record<path, {        // every file written
    lines, characters, destinationPath
  }>
  previews: Record<…, Preview>
  mappings?: Record<…, Mapping>
  results: ResultsItem         // per-(generator × item) outcome
  parseIssues: ParseIssue[]    // always present; empty array = no issues
}
```

### The `results` map

Nested: `traceId → spanId → "generate" → generatorId → identifier →
ResultType`.

```jsonc
{
  "trace-1778185255674": {
    "span-1778185255674": {
      "generate": {
        "@skmtc/gen-shadcn-form": {
          "mutation_CreateApplicant": "success",
          "query_GetApplicants": "notSupported"
        },
        "@skmtc/gen-zod": {
          "ApplicantModel": "error"
        }
      }
    }
  }
}
```

Each leaf is one of:

- `success` — generator ran, produced output for this item
- `warning` — produced output with a recoverable issue logged
- `error` — generator threw or returned failure; output missing or partial
- `skipped` — item matched but deliberately skipped (e.g., by `client.json`
  filters)
- `notSupported` — generator's `isSupported` returned false — _expected_ for
  items outside the generator's scope

### Per-operation results

The result granularity is `(generator × item)`. If you have 100 operations and 5
generators, the manifest contains up to 500 results. You can ask "which
operations did this generator process, and how?"

## Exit code derivation

The CLI exits non-zero when any `parseIssue.level === 'error'` is present:

```
1. parseIssues is empty or has only level: 'warning' entries
2. typecheck (if --typecheck) passed
   → Exit 0

vs

1. parseIssues contains any level: 'error' entry
   → Exit 1

or

1. typecheck (if --typecheck) failed
   → Exit 1

or

1. Missing required CLI args in strict mode
   → Exit 2 with recipe error
```

This is the agent contract: a CI run that exits 0 is success; a run that exits 1
has captured failures in the manifest's parseIssues array (which agents can
parse and present).

The manifest persists regardless of exit code. Even a failed run writes the
manifest — the diagnostic record survives.

## Why no thrown exceptions to the caller?

A throw-based error model is wrong for SKMTC's use case:

1. **Partial output is valuable.** A schema with 100 operations and one broken
   schema can still produce 99 useful files. Throwing on the first error kills
   the other 99.

2. **The manifest is structured.** Errors as exception messages lose structure —
   they're strings. The manifest is JSON, which agents can grep, transform, and
   route.

3. **Cascading failures need representation.** A single broken `User` schema
   produces many `INVALID_DEPENDENCY_REF` issues. A throw model would surface
   only the first; the manifest surfaces all of them as separate entries.

4. **Recoverable warnings exist.** Missing `type` fields, unexpected properties
   — these aren't errors but deserve recording. Throws can't carry warnings; the
   manifest can.

## Common questions

### What if my generator wants to fail loudly?

Generators _can_ throw — and the catch in `#runOasOperationGenerator` will
convert the throw into a `result: 'error'` for that operation. That's the right
path for "this operation is malformed and I can't produce sensible output."

Whole-run failure (exit 1) is achieved by logging an `INVALID_SCHEMA` issue at
parse time (which already happens for top-level parse errors). User-level "stop
the world" controls aren't first-class — the model assumes partial output is
always preferable to no output.

### Why are warnings still mirrored to stderr instead of just the manifest?

For developer ergonomics. Looking at the manifest after every run is overhead;
seeing warnings flow past on stderr surfaces issues in-the-moment. The manifest
is the canonical record; stderr is the human-readable preview.

### Can I filter out specific warnings?

Not at the engine level. The leniency-strictness pairing is intentional — we
want users to see what was inferred. If a warning is genuinely noise (e.g., your
schema legitimately doesn't declare `type` for historical reasons), the right
answer is to fix the source schema, not silence the warning.

### What if I want to abort generation on the first error?

There's no `--strict-parse` flag. You can post-process the manifest: if
`parseIssues.some(i => i.level === 'error')`, treat the run as failed and
discard the partial output. CI flows often do this with a follow-up `jq` check
after `skmtc generate`.

### Does this philosophy apply to Generate phase errors too?

Yes. Each `(generator, operation)` pair runs inside a try/catch in
`#runOasOperationGenerator`. A generator throwing for one operation doesn't
affect siblings. The manifest records the per-operation result.

The Render phase is intentionally simpler — it's pure serialization of the file
map produced by Generate. Errors at Render time typically indicate a structural
bug (something is in `#files` that can't be stringified), which is a bug to fix
rather than a recoverable diagnostic.

## Further reading

- [The three phases](the-three-phases.md) — where Parse-time errors get isolated
- [Refs and resolution](refs-and-resolution.md) — how the ref-error cascade
  works
- [The StackTrail](the-stack-trail.md) — the mutable position-stack that
  addresses, locates, and bridges to `$ref` strings
- [The manifest](the-manifest.md) — the structured run record `parseIssues`
  lives in, plus the `results` tree and `previews` / `mappings`
- [Manifest format reference](../reference/manifest-format.md) — the full
  Valibot schema
- [Error codes reference](../reference/error-codes.md) — the full list of issue
  types
- [`skmtc-debug` skill](../skills/skmtc-debug/SKILL.md) — operational diagnosis
  using the manifest
- [Design philosophy: lenient input, strict diagnostics](../explanation/design-philosophy.md)
  — the broader rationale
