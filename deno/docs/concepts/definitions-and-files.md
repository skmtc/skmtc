# Definitions and files: the create-or-reuse model

> Generation does not append text to files. A file is an object with
> keyed maps — `imports` and `definitions` — and generating code means
> writing definition objects into file objects. Because the maps are
> keyed, files double as a cache; because every producer creates the
> definitions it depends on, inserting is create-or-reuse; and because
> inserting is create-or-reuse, generation produces the same valid
> output in any order. This page is the shortest complete statement of
> that mechanism. Read it before the deeper pages it links to.

If you arrive from other codegen tools, you likely carry this model:
templates run over a schema in a fixed order, each appending text to
an output buffer, and anything shared between outputs must be
generated first or wired up by hand. Judged by that model, SKMTC —
many independent generators writing into shared files, in no
particular order — looks like it shouldn't work. It works because the
model is different at the bottom: output is not text being appended
but keyed objects being inserted, and insertion is idempotent.

## The model in one breath

1. A file is an object carrying keyed maps — most importantly
   `definitions`, which maps an identifier to its value, and
   `imports`, keyed by source module. (TypeScript files carry a third
   map, `reExports` — see
   [files-and-dedup.md](files-and-dedup.md).)
2. Generating code means writing definition objects into file
   objects. Nothing is text until the Render phase serializes each
   file at the end.
3. Because the maps are keyed, a file doubles as a **cache**:
   inserting a definition that is already registered is a lookup, not
   a recompute.
4. Every producer — a [Projection or
   Snippet](projections-and-snippets.md) — creates the definitions it
   depends on, during its own construction.
5. Combined, 3 and 4 make inserting **create-or-reuse**: a producer
   asking for a dependency either constructs it (first time) or
   reuses the registered definition (every time after).
6. Therefore generation order cannot affect output: each generator
   either creates or reuses its dependencies, and the file maps
   converge to the same content whichever generator runs first.

Point 6 is not an optimization — it is the property that makes the
whole system composable. The rest of this page unpacks the chain.

## A file is a keyed object, not a text buffer

```ts fragment
// the shape that matters (TsFile, abridged)
class TsFile {
  imports: Map<string, TsImport> // keyed by source module
  definitions: Map<string, TsDefinition> // keyed by the identifier's declaration slot
  reExports: Map<string, TsReExport> // keyed by source module
}
```

During Generate, `GenerateContext` holds a map of path → file object,
and generators write into those objects through `register` and the
`insert*` methods. At Render time each file serializes its maps in a
fixed order (re-exports, then imports, then definitions) into the
final source text. Two consequences fall out immediately:

- **Imports dedup for free.** Two producers registering
  `{ zod: ['z'] }` against the same file produce one merged import
  line, because the map is keyed by module.
- **Definitions can be shared.** A definition written once under its
  identifier is visible to every later lookup of that identifier —
  which is what turns the file into a cache.

## Insert is create-or-reuse

Here is the mechanism on a concrete pair. A query-hook producer needs
the Zod schema for a response body, so it inserts it:

```ts fragment
// inside the hook Projection's constructor
const zodResponse = this.insertNormalizedModel(ZodProjection, {
  schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
  fallbackName: `${decapitalize(settings.identifier.name)}Response`
})

this.zodResponseName = zodResponse.identifier.name
```

What the engine does with that call:

```
insertNormalizedModel / insertModel / insertOperation
        │
        ▼
is (identifier.name, exportPath) already in the
destination file's definitions map?
        │
  ┌─────┴──────────────────────────┐
  no — create                      yes — reuse
  │                                │
  ▼                                ▼
construct the dependency's    integrity check passes →
producer; its constructor     return the registered
inserts ITS dependencies      definition (a lookup,
the same way (recursion       not a recompute)
bottoms out at producers
with no dependencies)
  │
  ▼
write the Definition into
the file object
        │
        ▼
the caller interpolates the identifier into its
own template; if the two land in different files,
the engine registers the import between them
```

The recursion in the create branch is point 4 of the model: the
`ZodProjection` constructed here inserts the TypeScript type *it*
depends on, and so on down. No generator ever assembles its
dependency tree up front — each producer pulls in exactly what it
needs, and the cache turns repeated pulls into lookups.

## Why order cannot matter

Run `gen-zod` before the hook generator, and the hook's insert finds
the schema already registered — reuse. Run it after, and the hook's
insert creates the schema first; when `gen-zod` reaches the same
schema, *it* reuses. Either way the definitions map ends up with one
schema under one identifier, and the rendered output is identical.
This is the mechanism behind two things you can observe directly:
re-running a generation produces byte-identical output, and
reordering generators in `client.json` changes nothing. The proof
walkthrough lives in
[how-idempotency-works.md](../explanation/how-idempotency-works.md).

## Duplication or collision? Generator keys

One question remains: when an insert finds the identifier already
registered, how does the engine know the registered definition is
*the same thing* and not a different definition that happens to want
the same name? Every definition inserted through a Driver carries a
**generator key** — a record of which generator and which schema or
operation produced it. On a cache hit the engine compares keys:

- **Same key** — same generator, same input: safe reuse. This is the
  duplication case, and it is expected.
- **Different key** — two different generator-and-input pairs landed
  on the same name in the same file: a real naming collision. The
  engine throws `Registered definition mismatch` rather than silently
  keeping one and dropping the other.

That distinction — duplication is reuse, collision is an error — is
what lets first-write-wins dedup stay safe. The full integrity story,
including how to read the mismatch error and the shapes a generator
key can take, is in [files-and-dedup.md](files-and-dedup.md).

## Common questions

### Is output deduplicated after generation?

No. There is no post-pass — a duplicate never exists in the first
place, because the definitions map gates writes by key. What you see
in the output is exactly what the maps accumulated.

### Do I need to order generators in `client.json`?

No. Order affects nothing observable. Install order and array order
are both irrelevant to output — see
[cross-generator-coordination.md](cross-generator-coordination.md)
for how generators reference each other's output without ordering.

## Further reading

- [Files, deduplication, and integrity](files-and-dedup.md) — the
  file object in full: per-map dedup rules, the integrity layer, and
  generator key shapes
- [Cross-generator coordination](cross-generator-coordination.md) —
  the multi-generator view: how producers reference each other's
  definitions by name
- [How generators produce output](how-generators-produce-output.md)
  — the producer side: `transform`, `register`, and the pull-based
  flow that calls the inserts described here
- [How idempotency works](../explanation/how-idempotency-works.md) —
  the worked A/B ordering proof that output is order-independent
- [Reference: file classes](../reference/api/dsl-file.md) — the
  API-level reference for `FileBase`, `TsFile`, and `JsonFile`
