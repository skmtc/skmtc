# Cross-generator coordination

> Why generators can run in any order and still produce consistent
> output: memoization keyed by deterministic identifiers, with cache
> hits guaranteed to produce the same Definition that a fresh
> construction would.

The whole mechanism in one page:
[Definitions and files](definitions-and-files.md). This page deepens
its multi-generator side.

Cross-generator coordination in SKMTC is **memoization keyed by
`(identifier.name, exportPath)`**, where both halves of the key are
pure functions of the input. Same inputs → same key → same cached
value. Generator execution order does not affect output.

## The one-line definition

When a generator needs output from a peer generator (e.g., a form
generator needs the Zod validator for its request body), it calls
`insertOperation(PeerProjection, op)` or
`insertNormalizedModel(PeerProjection, args)`. The Driver computes
the peer's identifier and exportPath, looks up the cache. Cache hit:
returns the existing Definition. Cache miss: constructs the peer
Projection, registers it, returns it. Either way, the consumer gets
the peer's name back via `.toName()` and uses it in its own template.

## The problem coordination solves

A multi-generator pipeline has dependencies. A form generator needs
the Zod schema for validation. A query hook generator needs the
TypeScript type for arguments. A table generator needs the query
hook to fetch data.

The naive answer is "run the dependency generator first." But that
requires:

- Knowing which generator goes first (a topological sort)
- Maintaining dependency declarations as generators evolve
- Handling conditional dependencies
- Resolving ambiguity when two generators could "be first"
- Coupling generators tightly — generator A has to know it depends
  on generator B

SKMTC's answer: **make order irrelevant**. Coordination happens
through a Map cache. Whoever needs a definition asks for it; if it's
already in the cache, return the cached value; if not, construct it.
Order of asking doesn't matter — same inputs produce the same
outputs.

## The mechanism: memoization by `(name, exportPath)`

The cache lives in `GenerateContext.#files`. Each `File` has a
`definitions: Map<string, Definition>`. The cache key is
`(identifier.name, exportPath)` — name is the key within the file's
map, exportPath identifies which file's map.

Both halves of the key are computed by **static methods on the
Projection class**:

- `toIdentifierName({ operation, enrichments, variant })` → the name string
- `toExportPath({ operation, enrichments, variant })` → string path

(A third static, `toIdentifierType`, supplies the non-name parts of
the identifier — entity type, exportedness — and runs only on cache
miss. It is not part of the cache key.)

These methods are required to be **pure functions** of their inputs.
No `this`-side state. No environmental reads. No async.

The purity invariant is what makes the memoization work. Two callers
asking for the same projection on the same operation compute the
same key. The first call creates the entry; subsequent calls hit
the cache.

## Identifier and exportPath are pure functions

From `gen-shadcn-form/src/base.ts`:

```ts
export const ShadcnFormBase = toTsOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,

  toEnrichmentSchema,

  toIdentifierName({ operation, variant }): string {
    const verb = capitalize(toMethodVerb(operation.method))
    const base = `${verb}${camelCase(operation.path, { upperFirst: true })}Form`
    return withVariant(base, variant)
  },

  toIdentifierType: () => ({ type: 'variable' }),

  toExportPath({ operation, enrichments, variant }): string {
    const name = this.toIdentifierName({ operation, enrichments, variant })
    return join('@', 'forms', `${name}.generated.tsx`)
  }
})
```

Notice the constraints:

- Functions of `(operation, enrichments)` only
- No `this`-side state read (this.someField doesn't influence outcome)
- No async (no Promise, no `await`)
- No environmental reads (no Date, no Math.random, no `process.env`)

If you violated any of these, two callers with the same
`(operation, enrichments)` could compute different keys. The cache
would split into two entries, generators would produce duplicate
definitions with subtle differences, and the order-independence
guarantee would break.

The purity invariant is convention-enforced, not type-enforced. The
verification checklist in the `skmtc-generator` skill explicitly
calls out the purity requirement.

## The Driver flow

When code calls `context.insertOperation({ projection: MyProjection, operation })`
(or the positional projection-base wrapper `this.insertOperation(MyProjection, operation)`
that auto-fills `destinationPath`):

1. **Compute settings.** Driver calls `MyProjection.toIdentifierName(...)`
   and `MyProjection.toExportPath(...)` to produce the cache key
   (`toIdentifierType` fills in the rest of the identifier).

2. **Look up cache.** Driver calls
   `context.findDefinition({ name, exportPath })`.

3. **Cache hit?** Driver runs `affirmDefinition` integrity check:
   does the cached Definition's `generatorKey` match this Projection's
   `generatorKey`? Does its value implement `MyProjection`? If yes →
   return cached. If `generatorKey` mismatch → throw
   `"Registered definition mismatch"`.

4. **Cache miss?** Driver instantiates `new MyProjection({...})`. The
   constructor runs — it may register imports, call `insertOperation`
   / `insertNormalizedModel` for *its* dependencies recursively. The
   result is wrapped in `Definition`.

5. **Register the new Definition** in the target file via
   `context.register({ definitions, destinationPath: exportPath })`.

6. **Stitch the import.** If the calling file is different from the
   Projection's `exportPath`, register an import in the calling file
   pointing at the new Definition.

The recursion is depth-first. A form generator that calls
`insertOperation(TanstackQuery, op)` will trigger TanstackQuery's
full construction (with its own `insertNormalizedModel` calls for
the Zod schema and TS type) before returning. By the time
`insertOperation` returns, the dependency chain is fully populated.

`ModelDriver` also brackets each invocation with a
`context.modelDepth[`${generatorId}:${refName}`] = 0` reset
before and after the Projection's construction. This is the
*model-recursion* cycle-break — orthogonal to the cache key, and
used by `Ref` Snippets (`ZodRef`, `TsRef`, etc.) to detect
self-referential schemas and avoid stack overflow. See
[the-type-system.md §Handling recursive types](the-type-system.md#handling-recursive-types--the-modeldepth-counter).

## Why order doesn't matter

The structural argument:

- Two generators A and B exist. A depends on B's output.

- **Scenario 1**: A's `transform` runs first. A's constructor calls
  `insertOperation(B, op)` → B's Projection is constructed and
  cached. Then B's own outer-loop `transform` runs → calls
  `insertOperation(B, op)` → cache hit, no work.

- **Scenario 2**: B's `transform` runs first. B's Projection is
  constructed and cached. Then A's `transform` runs → calls
  `insertOperation(B, op)` → cache hit. A's Projection is
  constructed with B's name in scope.

In both scenarios, the final `#files` map is identical. The only
difference is *which* `transform` triggered B's construction. The
output bytes are the same.

This is a **structural** property, not a heuristic. The system
*can't* produce order-dependent output because:

1. Cache lookup is the first step in the Driver flow
2. Keys are pure functions of input
3. Constructor side effects (`register`) are idempotent (Set/Map semantics)

Idempotency by construction is the
[design philosophy](../explanation/design-philosophy.md) principle
this property realizes.

## Cache integrity asymmetries

The integrity-check rigor differs by code path:

| Path | Check | Same-name collision from different generator |
|---|---|---|
| `insertOperation` / `insertModel` via Driver | `affirmDefinition`: `generatorKey` match + `instanceof` check | **Throws loudly** |
| `insertNormalizedModel` ref branch (delegates to insertModel) | Same as Driver | Throws loudly |
| `insertNormalizedModel` fallback-name branch (for inline schemas) | Name-only check | **Silent merge** |
| Direct `register({ definitions })` | Name-only check in `File.definitions.has(name)` | First-write-wins silently |

The asymmetry is a known gap — the fallback-name path
lacks the strict integrity check that the Driver path has. In
practice this only matters when two generators happen to produce the
same `fallbackName` for *different* inline schemas in the same file
— which is rare but possible. The pragmatic mitigation is to use
ref-based schemas where possible, since they route through the
strict Driver path.

## Coordination is by name, not by content

A key consequence of the memoization model: **generators never read
each other's `toString()` output**. They reference peer outputs by
identifier name.

```ts
// In ShadcnForm's constructor
this.clientName = this.insertOperation(TanstackQuery, operation).toName()
// → e.g., "useCreateUsers"

// In ShadcnForm's toString
return `
  const mutator = ${this.clientName}()
  // ...
`
```

`insertOperation` returns an `Inserted<V, EnrichmentType>` wrapper
with a `.toName()` method that surfaces the peer's identifier name.
The form embeds the name in its template. It never reads what
TanstackQuery's `toString()` actually produces.

This is the right architecture. Reading another generator's source
text would couple the consumer to formatting choices and force
re-parsing. Coordination by name keeps the interfaces clean and the
peer free to change its template internally.

## Why call `insertOperation` instead of `Producer.toIdentifierName(op)`?

Static `Producer.toIdentifierName(op)` returns the same string as
`insertOperation(Producer, op).toName()`. It's tempting to prefer the
static call — it looks lighter, doesn't allocate, and the name is what
the consumer's `toString()` actually needs. Don't. The static call
computes the name; `insertOperation` *also* runs the four side effects
the framework needs to make that name resolve at render time.

| What `insertOperation(Producer, op)` does | What static `Producer.toIdentifierName(op)` skips |
|---|---|
| **Registers the producer's `Definition`** at `Producer.toExportPath(op)`. On a cache miss, the Driver instantiates `new Producer(...)`, wraps the value, and writes it into the target `File`'s `definitions` map. | If no Driver path ever runs the producer for `op`, the producer's value is never wrapped in a `Definition` and never lands in any `File`. The consumer's rendered code references an identifier no `File` exports. |
| **Registers the cross-File import.** When `consumer.settings.exportPath !== Producer.toExportPath(op)`, the Driver calls `register({ imports, destinationPath })` so the consumer's File has an `import { ProducerName } from 'producer/path'` entry. | The consumer's File contains the name string but no import line for it. The consumer app fails to resolve the symbol at TypeScript-compile time as `Cannot find name 'ProducerName'`. |
| **Establishes Definition registration order within a File.** The Driver writes the producer's Definition into `File.definitions` before returning control to the consumer's constructor — so when the File is later serialized, the producer's `export const` appears before the consumer's. | When the consumer's `toString()` produces an eager top-level expression that reads the producer's value at module load — e.g., `export const X = { ...PRODUCER_CONST }` — the producer can land *after* the consumer in the same File's serialization order. Result: `Cannot access 'PRODUCER_CONST' before initialization` (TDZ) at consumer-app runtime. The error is silent at TypeScript-compile time; it surfaces only when the generated code executes. |
| **Re-resolves the producer on every cache miss.** The Driver re-evaluates `Producer.toIdentifierName`, `Producer.toExportPath`, and (on miss) runs the constructor — including any nested `insertOperation` / `insertModel` calls. Refactors to the producer (rename, move, new transitive imports, new variant) follow through every consumer automatically. | The static call returns whatever the producer's `toIdentifierName` currently produces, but contributes nothing to import wiring, dependency Definition registration, or transitive composition. If the producer's `exportPath` moves, every static call site keeps returning the right name string while *no* call site updates the consumer File's import to point at the new location. |

Default: call `insertOperation(Producer, op)` and use `.toName()`. The
static form is justified only inside a static method on the
*consumer's* own Projection class, where `this` doesn't exist and the
call site has no constructor through which to side-effect anything.
Even there, a separate `insertOperation` call must run elsewhere in
the dispatch chain so the producer's Definition and import are wired.

## Type-level coupling between generators

The cache-based coordination above wires *names*, *Definitions*, and
*imports* at SKMTC's generate time. There's a separate axis where one
generator's emitted output references the *TypeScript type* of another
generator's emitted value at the consumer app's compile time.

Two ways to write that type into the emitted output:

**By identifier** — emit a type expression that names the producer's
emitted type directly:

```ts
// Emitted in the consumer's output:
type Dto = CustomerCustomerDto
```

Use when the producer emits a named type and the consumer's emitted
code needs exactly that name in scope. The producer's identifier must
be importable into the consumer's File — same import-registration
requirement as any cross-File reference.

**By TypeScript inference** — emit a type expression derived from the
producer's emitted *value* using TS type operators:

```ts
// Emitted in the consumer's output:
type Dto = NonNullable<ReturnType<typeof useCustomer>['data']>
```

Use when the producer emits a value (hook, function, const) and the
consumer wants whatever type the value happens to expose. The consumer
doesn't need to know — or hardcode — the producer's identifier for the
type alias; whatever shape the producer's value has is what flows.

These solve different problems. The choice between them is about
*what's emitted in the consumer's output*, not about how the framework
wires things. Both still require the producer's value to be reachable
at the consumer app's compile time, which is what
`insertOperation(Producer, op)` in the consumer's constructor wires.

## Common patterns

### Pattern: inserting a sibling Projection

```ts
// In base.ts
const MyBase = toTsOasOperationProjectionBase<EnrichmentSchema>({
  id, toIdentifierName, toIdentifierType, toExportPath, toEnrichmentSchema
})

// In MyProjection.ts
class MyProjection extends MyBase {
  peerName: string

  constructor(args) {
    super(args)
    this.peerName = this.insertOperation(PeerProjection, args.operation).toName()
  }

  override toString() {
    return `... ${this.peerName} ...`
  }
}
```

`insertOperation` is the right call when you need a sibling operation
Projection (e.g., a form generator needs its mutation hook).

### Pattern: inserting a normalized model

```ts
const bodyType = this.insertNormalizedModel(TsProjection, {
  schema: operation.toRequestBody(({ schema }) => schema),
  fallbackName: `${this.settings.identifier.name}Body`
})
this.bodyTypeName = bodyType.identifier.name
```

`insertNormalizedModel` handles both `$ref` schemas (which route
through the model cache, with strict integrity check) and inline
schemas (which use the fallback name, looser check). The Driver
picks the right path automatically based on whether the schema is a
ref.

### Pattern: composing in a Snippet

A Snippet inside a Projection can also reach for peer Projections,
using `this.context.insertOperation(...)` directly (Snippets don't
have the projection-base wrapper that auto-fills `destinationPath`).

```ts
class FieldDispatch extends SnippetBase {
  refTargetName?: string

  constructor({ context, schema, destinationPath }) {
    super({ context })

    if (schema.isRef()) {
      const inserted = context.insertNormalizedModel(SomePeerProjection, {
        schema,
        fallbackName: 'unused-when-it-is-a-ref',
        destinationPath
      })
      this.refTargetName = inserted.identifier.name
    }
  }

  override toString() {
    return this.refTargetName ?? '/* inline */'
  }
}
```

### Pattern: operation-reference (consumer-chosen peer)

The three patterns above cover *statically-known* peers — your
generator imports the peer's Projection class and hands it a specific
schema or operation. The **operation-reference protocol** covers the
harder case: your generator's output for one operation depends on
some *other* operation, whose identity the consumer specifies as a
string in their enrichment.

Canonical case (`gen-shadcn-form/src/schemaToField.ts`): a form
renders a field whose values come from a list endpoint that the
consumer names. The form generator doesn't know in advance which
endpoint backs the field; the consumer points at one (by tag,
fieldName, or path) in their enrichment payload.

```ts
// Inside a Snippet that decides what to render for one field:
const referencedTag = enrichment?.references  // e.g. 'GetOffices'

// 1. Look up the operation by name (here: a tag). The consumer
//    has chosen the lookup key — its meaning is part of the
//    consumer-generator's enrichment schema, not core.
const operation = context.document.value.operations.find(op =>
  op.tags?.includes(referencedTag) &&
  // 2. Verify a producer generator can serve this operation.
  ShadcnSelectInput.isSupported({ context, operation: op })
)

if (operation) {
  // 3. Insert — same insertOperation as the static-peer pattern.
  //    The Driver dedupes Definition registration across calls and
  //    registers the import on the calling file.
  const def = context.insertOperation({
    projection: ShadcnSelectInput,
    operation,
    destinationPath: settings.exportPath
  })

  // 4. Reference by name in the rendered markup.
  return `<${def.identifier.name} lens={lens.focus('${path}').defined()} />`
}
// fall back to a plain field if no reference is set
```

The four meeting points between consumer and producer:

| Meeting point | Lives in |
|---|---|
| The reference string (tag / fieldName / path) | Consumer's enrichment payload, declared in the consumer's `enrichments.ts` |
| `isSupported(op)` predicate | Producer's `mod.ts` |
| `toIdentifierName(op)` / `toExportPath(op)` | Producer's `base.ts` (the content-addressed identity) |
| `insertOperation` call | Consumer's Projection / Snippet constructor |

The consumer imports the producer's Projection as a *type-level
package dependency* — exactly like `gen-shadcn-form` imports
`ShadcnSelectInput` from `gen-shadcn-select`. No runtime config
sharing, no cross-namespace enrichment peeking, and the dedup +
import-registration that the static-peer pattern gets stays intact.

**Anti-pattern**: reading the producer's enrichments directly from
`context.settings.enrichments['@scope/gen-other']`. That couples the
consumer to the producer's leaf shape (which is the producer's
private choice) and breaks the dependency-graph model. If you find
yourself reaching for it, you want an operation-reference enrichment
instead.

## Common questions

### Can two different generators produce the same identifier at the same path on purpose?

No — the Driver path will throw `"Registered definition mismatch"`.
The cache is a uniqueness invariant. If two generators legitimately
need the same name in the same place, one of them needs to
disambiguate (e.g., by adding a prefix in its `toIdentifierName`).

### What if my Projection has a non-pure `toIdentifierName`?

The system will still run, but you lose the order-independence
guarantee. Cache lookups can be inconsistent, you may see duplicate
definitions appear or "Registered definition mismatch" errors that
are hard to debug. The purity invariant is enforced by convention,
not by the type system.

### Is `transform` itself memoized?

No. The outer loop iterates `(generator, operation)` pairs and calls
each generator's `transform`. The memoization is at the *Projection*
level, not the generator level. A generator's `transform` runs once
per operation; the Projection's *constructor* may be skipped if the
cache is hit.

### Why is the fallback-name path looser than the Driver path?

Historical: the fallback-name path was added to support inline
schemas without requiring `$ref` everywhere. The integrity check there is
a known gap. The pragmatic answer is to use ref-based
schemas where possible — they route through the strict Driver path.

### Can I read peer generators' source text in an emergency?

You shouldn't. The interface between generators is the *name*.
Reading source text couples you to formatting and breaks if the peer
generator changes its template literal. If you need more from a peer
than its name, the right answer is to add an enrichment to its
schema or contribute a public API to the peer.

### What's the cost of a cache miss vs hit?

A cache miss runs the full Projection constructor — which can
recursively trigger more constructions if the Projection has its own
`insertOperation` calls. A cache hit is a Map lookup plus the
integrity check, basically free. In practice, the first generator
that asks for a given Projection pays the construction cost; all
later askers get hits.

### What happens if I `insertOperation` on a generator that isn't installed?

You get a TypeScript error at the import level (the Projection class
isn't importable). Cross-generator coordination requires the peer
generator to be in `deno.json#imports` (either as a JSR install or a
local clone) so its source can be bundled into `worker.ts`.

## Further reading

- [How generators produce output](how-generators-produce-output.md) — `GenerateContext`'s iteration over `(generator × item)` pairs, `transform` as a side-effect hook, the pull-based Projection model that this page's cache key sits inside
- [Files, deduplication, and integrity](files-and-dedup.md) — the integrity-key (`generatorKey`) layer on top of the cache key documented here, plus the dedup rules for the file maps Drivers write into
- [Composing output with Stringable](stringable-composition.md) — how `Inserted.toName()` plugs into a consuming generator's template
- [The three phases](the-three-phases.md) — the broader pipeline context
- [Projections and Snippets](projections-and-snippets.md) — the DSL layer
- [How idempotency works](../explanation/how-idempotency-works.md) — the design rationale
- [API reference: generate-context](../reference/api/generate-context.md)
- [How to compose with another generator](../authoring/how-to/compose-with-another-generator.md) — the task-level guide
