# The three phases

A SKMTC generation run is a pipeline. The interesting work happens in three
sequential phases — **Parse**, **Generate**, and **Render** — each producing an
immutable artifact that the next consumes.

This document explains what each phase does, why the boundaries are drawn where
they are, and what invariants depend on the separation. It's organized for
understanding, not lookup; for the API surface of each phase see
[the reference docs](../reference/api/).

## The shape of the pipeline

```
Schema input ──▶  PARSE  ──▶  GENERATE  ──▶  RENDER  ──▶  Artifacts
                  │            │             │
                  │            │             │
              parsed model  files map   serialized
              + issues      (in-memory) strings
```

Each arrow is a one-way data hand-off. By the time a phase finishes, its output
is locked in — the next phase reads it but can't change it. This is structural:
each phase has its own context class (`ParseContext`, `GenerateContext`,
`RenderContext`) that holds the in-progress state, and the hand-off to the next
phase is a method call that produces an output value.

```ts
// core/run/toArtifacts.ts (sketch)
const parseContext  = new ParseContext({ input, ... })
const parsedDocument = parseContext.parse(stackTrail)

const generateContext = new GenerateContext({ document: parsedDocument, settings, ... })
const { files }       = generateContext.toArtifacts(stackTrail)

const renderContext = new RenderContext({ files, ... })
const { artifacts } = renderContext.render(stackTrail)
```

The phases share a `StackTrail` (for location tracking in diagnostics) and a
`Logger`. Everything else flows phase-to-phase as an explicit return value.

## Why three phases?

You could imagine fewer or more. Single-phase ("everything in one pass") is what
most simple codegen tools do. Two-phase ("parse and render") is the next step
up. Three-phase is where SKMTC settles, and the reasons are concrete:

**Parse is separate because** the parse-time error model is fundamentally
different from generate-time. Parsing tolerates partial failure (one bad schema
doesn't kill the run; it produces a `ParseIssue` and prunes downstream
consumers). Generate is permitted to assume everything in `parsedDocument` is
valid. Combining the two would force every generator to defensively handle
malformed schemas.

**Generate is separate from Render because** cross-generator coordination needs
a settled model of "what files exist and what's in them" before serialization.
Two generators may both contribute imports to the same file; the order of
contributions doesn't affect output, but only because Render runs after both are
done. If Render were interleaved with Generate, generator A's output would
already be a string by the time generator B tried to add an import to the same
file.

**Render is separate from Persist because** the in-memory artifact map is the
boundary with the host process. Inside the Worker, Render produces
`Record<path, content>`. The Worker then `postMessage`s this back to the host,
which writes to disk. The host doesn't have a notion of `File` or `Definition`;
it sees only `{ path, content }`. That clean boundary is what lets the host be
permission-unconstrained while the Worker is sandboxed.

## Phase 1: Parse

**Purpose:** Convert raw schema input into a typed, navigable internal model
that downstream phases can rely on.

**Input:** `SkmtcDocumentInput` — a discriminated union, either
`{ type: 'oas', value: OpenAPIV3.Document }` or
`{ type: 'gql', value: GraphQLSchema | string }`.

**Output:** `SkmtcParsedDocument` (`{ type: 'oas', value: OasDocument }` or
`{ type: 'gql', value: GqlDocument }`), plus a populated `ParseContext.issues`
array.

**Where it runs:** Inside the Worker. (The host _does_ run a pre-parse step for
OAS — see [the worker runtime concept](the-worker-runtime.md) for why — but the
protocol-specific parse always happens worker-side.)

### Mechanism

The walk is recursive descent. `core/oas/document/toDocumentFieldsV3.ts`
destructures the OAS document and traces each top-level field (`info`, `paths`,
`components`, …) into a child parser. Each child parser does the same for its
sub-fields. The accumulated location is carried in a `StackTrail`:

```ts
operations: stackTrail.trace(
  "paths",
  (st) => toOperationsV3({ paths, stackTrail: st, context }),
);
```

Every `trace(key, fn)` pushes `key` onto the trail before calling `fn`, and pops
it after. So an error at
`paths['/users']['post'].requestBody.content['application/json'].schema.properties.email`
has a precise location string in its `ParseIssue` without any individual parser
explicitly threading path information.

### Two-tier error isolation

Parse uses two complementary mechanisms to ensure one bad item doesn't kill the
run.

**Tier 1 — per-item isolation via `tryParseAt`.** Every per-item parser is
wrapped:

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
    output[key] = value; // bad entries silently omitted
  }
}
```

A throw inside `toSchemaV3` becomes a `level: 'error'` `ParseIssue`, and the key
is skipped in the output map.

**Tier 2 — cascade pruning via `removeErroredItems`.** During the walk, every
`$ref` consumer is recorded in `ParseContext.#refConsumers`. When a parse error
happens at a component position, the error is recorded in
`ParseContext.#refErrors` keyed by the same ref. After the walk finishes:

```ts
for (const [refKey, errors] of this.#refErrors) {
  for (const error of errors) {
    const consumers = this.#refConsumers.get(refKey) ?? []
    for (const stackTrail of consumers) {
      const removed = oasState.oasDocument.removeItem(stackTrail)
      if (removed) {
        this.issues.push({
          protocol: 'oas',
          level: 'error',
          type: 'INVALID_DEPENDENCY_REF',
          location: stackTrail.toString(),
          ...
        })
      }
    }
  }
}
```

So if `User` fails to parse and `Operation X` referenced `User`, `Operation X`
is removed from `oasDocument.operations` with an `INVALID_DEPENDENCY_REF` issue.
The downstream Generate phase sees a smaller document with all surviving items
guaranteed valid.

The cascade is one hop deep by current design — transitive pruning of
consumers-of-pruned-consumers is a known limitation, partially mitigated by the
fact that `resolve()` on a now-missing ref will throw at generate time, which
`#runOasOperationGenerator` catches as a per-operation error.

### Type-inference fallbacks

`toSchemaV3` (`core/oas/schema/toSchemasV3.ts:75-252`) dispatches on
`schema.type`. But OAS documents in the wild often omit `type` for object-shaped
schemas. Rather than failing, SKMTC infers:

- Has `properties` → assume `type: 'object'`, log a `MISSING_OBJECT_TYPE`
  warning.
- Has `items` → assume `type: 'array'`, log a `MISSING_ARRAY_TYPE` warning.
- Has a string-shaped `enum` or recognized string `format` → assume
  `type: 'string'`, log a `MISSING_STRING_TYPE` warning.
- Otherwise → fall through to `toUnknown`, which produces an `OasUnknown`
  schema.

"Be lenient on input, strict on diagnostics" — incorrect schemas produce code
anyway, but every assumption shows up in the issue log.

### Forward-reference handling

A `$ref` may point at a definition that hasn't been parsed yet. SKMTC handles
this without a two-pass scheme by giving each `OasRef` a live reference to the
in-progress document:

```ts
// core/oas/ref/toRefV31.ts
context.registerRef(stackTrail.clone(), $ref);
return new OasRef({ refType, $ref }, context.parsedDocument);
```

`context.parsedDocument` returns a `SkmtcParsedDocument` wrapping the _same
mutable_ `OasDocument` instance that the rest of the parse is filling in. The
`OasRef`'s `.resolve()` looks up its target at call time. Resolution succeeds as
long as the target has been populated by the time anyone resolves — which is
always true after parse completes.

### Output guarantees

By the time `parse()` returns:

- Every item in the output `OasDocument` (or `GqlDocument`) parsed without
  throwing.
- Every item that depended on a failed schema has been pruned, with an issue
  logged.
- `ParseContext.issues` contains the full diagnostic record.

The Generate phase can iterate `oasDocument.operations` and trust every
operation; it doesn't need defensive checks for "what if the request body schema
is malformed."

## Phase 2: Generate

**Purpose:** Walk the parsed document with the configured generators, producing
an in-memory map of files-to-render.

**Input:** `SkmtcParsedDocument`, `ClientSettings`, `toGeneratorConfigMap()`
(provides the registered generators).

**Output:** `{ files: Map<path, File | JsonFile>, previews, mappings }`.

**Where it runs:** Inside the Worker.

### The outer loop

`GenerateContext.toArtifacts` (`core/context/GenerateContext.ts:275`) iterates
the configured generators. For each generator, it applies filter checks, then
dispatches by generator type:

```ts
generators.forEach(generatorConfig => {
  stackTrail.trace(generatorConfig.id, st => {
    if (this.settings?.skip?.includes(generatorConfig.id)) return
    if (/* include filter excludes this generator */) return

    switch (generatorConfig.type) {
      case 'oasOperation': this.#runOasOperationGenerator(...)
      case 'gqlOperation': this.#runGqlOperationGenerator(...)
      case 'model':        this.#runModelGenerator(...)
    }
  })
})
```

Inside each `#run*Generator`, the per-item loop iterates operations or refNames,
applies item-level filters, calls the generator's `isSupported({ operation })`
capability gate, then calls
`generatorConfig.transform({ context, operation, acc })`. The transform is where
the generator produces its output — but not by returning strings (its return
value is discarded). Instead, the transform calls
`context.insertOperation(MyProjection, op)` or
`context.insertNormalizedModel(MyProjection, args)`, which delegate to Drivers.

### The Driver lifecycle

When `transform` calls `context.insertOperation(TanstackQuery, operation)`:

1. `new OasOperationDriver(...)` runs
   (`core/dsl/operation/oas/OasOperationDriver.ts`).
2. Driver computes
   `settings = context.toOperationContentSettings({ projection, operation })`,
   which calls the Projection's static `toIdentifier`, `toExportPath`, and
   `toEnrichments`.
3. Driver looks up
   `context.findDefinition({ name: settings.identifier.name, exportPath: settings.exportPath })`.
4. **Cache hit + `affirmDefinition` passes:** Driver returns the cached
   `Definition`. No work done.
5. **Cache hit + `generatorKey` mismatch:** Driver throws
   `Registered definition mismatch`. Loud failure.
6. **Cache miss:** Driver instantiates
   `new projection({ context, operation, settings })`. The Projection's
   _constructor_ runs — which may call `register({ imports, ... })`,
   `insertNormalizedModel(...)`, or even `insertOperation(...)` recursively for
   further dependencies. After the constructor returns, Driver wraps the value
   in a `Definition` and registers it via
   `context.register({ definitions: [definition], destinationPath: settings.exportPath })`.
7. If the calling file differs from `settings.exportPath` (e.g., a form file is
   asking for a hook in a services file), Driver also registers an import stitch
   into the calling file via `context.register({ imports, destinationPath })`.

### Why order doesn't matter

This is the single most important property of the Generate phase. Two facts
combine to make it work:

1. `toIdentifier` and `toExportPath` are _pure functions_ of
   `(operation, enrichments)`. Same inputs → same outputs.
2. The cache key is `(identifier.name, exportPath)`.

So whichever generator's `transform` runs first for a given
`(projection, operation)` pair triggers the construction. Later generators that
depend on the same projection (e.g., a form depending on a mutation hook) get a
cache hit. The output `#files` map is identical regardless of which order the
outer loop happens to visit generators in.

This is what underlies "generators run in any order" — it's a structural
property, not a feature you have to maintain.

### Output structure

`context.#files: Map<string, File | JsonFile>`. Each `File` contains:

- `imports: Map<module, Set<importName>>` — populated by
  `register({ imports })`. The `Set` is what dedupes.
- `reExports: Map<module, { [entityType]: Set<name> }>` — populated by
  `register({ reExports })`.
- `definitions: Map<name, Definition>` — populated by
  `register({ definitions })`. First-write-wins.

The `JsonFile` variant is used when the path ends in `.json`; instead of
definitions, it holds a JSON value.

By the time Generate finishes, every file's contents are fully determined. The
map is what's handed to Render.

## Phase 3: Render

**Purpose:** Serialize the files map to a `Record<path, content>` artifacts
payload.

**Input:** `Map<string, File | JsonFile>` from Generate.

**Output:**
`{ artifacts: Record<path, string>, files: Record<path, metadata> }`.

**Where it runs:** Inside the Worker.

### Mechanism

`RenderContext.collate` (`core/context/RenderContext.ts:185`) iterates the files
map and calls `file.toString()` on each:

```ts
const fileObjects: FileObject[] = fileEntries.map(([destinationPath, file]) => {
  return stackTrail.trace(destinationPath, (st) => {
    return renderFile({
      content: file.toString(),
      destinationPath,
      basePath: this.basePath,
    });
  });
});
```

`File.toString()` (`core/dsl/File.ts:181`) joins three sections:

```ts
return [reExports, imports, definitions]
  .filter((section) => Boolean(section.length))
  .map((section) => section.join("\n"))
  .join("\n\n");
```

That's the entire transformation. Imports get assembled from the
`Map<module, Set<name>>`. Definitions get stringified via their own `toString()`
(which produces `export const X = VALUE;` via the `Definition` wrapper). The
sections are joined with blank lines. No formatting, no analysis, no
transformation.

### What Render does _not_ do

Render does not format. `renderFile` takes the `content` produced by
`file.toString()` and returns it unmodified:

```ts
const renderFile = (
  { content, destinationPath, basePath }: RenderFileArgs,
): FileObject => {
  const path = toResolvedArtifactPath({ basePath, destinationPath });
  return {
    content: content, // ← raw, no formatting
    path,
    destinationPath,
    lines: content.split("\n").length,
    characters: content.length,
  };
};
```

A `grep` for `prettier.format` across `@skmtc/core` returns zero hits. No
formatter — Prettier, Biome, `deno fmt`, or otherwise — runs inside the
pipeline. **Generated output is unformatted.** Consumers run their own formatter
as a separate step (typically a pre-commit hook or build script).

This is a deliberate architectural choice, not an omission: formatting is the
consumer's concern. Generators produce syntactically valid TypeScript and trust
the consumer's toolchain to handle aesthetics.

### Output structure

`{ artifacts, files }` where:

- `artifacts: Record<resolvedPath, content>` — the actual file contents keyed by
  their resolved disk path (with `basePath` applied).
- `files: Record<resolvedPath, { destinationPath, lines, characters }>` —
  metadata used by the manifest.

This is what the Worker `postMessage`s back to the host.

## Phase boundaries as invariants

The three-phase model encodes several invariants that other code relies on:

1. **Parse output is immutable to Generate.** Generate doesn't add or remove
   items from `oasDocument`; it only reads. If you needed to add a synthetic
   operation, you'd have to do it during parse, not generate.

2. **Generate output is fully determined before Render.** Render is pure
   serialization; if a definition isn't in `#files` by the end of Generate, it
   won't appear in output. There's no "Render-time hook" for adding content.

3. **The Worker boundary aligns with the parse-safety boundary.** OAS gets
   converted to v3 host-side (so the clone-safe JSON crosses cleanly), then
   parsed worker-side. GraphQL SDL stays a string until inside the worker. The
   asymmetry is forced by `structuredClone`'s inability to handle class
   instances with cyclic back-references.

4. **The Worker boundary is also the security boundary.** Generators run
   sandboxed (no network, no subprocess). The host handles disk I/O outside the
   sandbox. The three-phase model maps cleanly onto this: parse and generate (in
   the worker) trust nothing from the host; persist (on the host) trusts only
   the artifact paths and contents that the worker returned.

## Common questions

**Can a generator run before Parse finishes?**

No. Generate operates on `SkmtcParsedDocument`, which only exists after Parse
completes. The two phases are strictly sequential.

**Can generators see each other's output during Generate?**

Yes — through the cache. When Generator A calls
`insertOperation(BProjection, op)`, the Driver instantiates `B` (if not cached)
and returns an `Inserted<...>` carrying the identifier name. A can use that name
in its own template. A cannot read B's _body_ (`toString()` output), but it
doesn't need to — coordination is by name, not by content.

**Can Render call back into Generate?**

No. Render is a one-way serialization. If your generator needs to know something
about other generators' output, it must happen during Generate via the
cross-generator coordination mechanism, not in Render.

**Why is OAS converted before the worker but GraphQL isn't?**

`structuredClone` (which the Worker `postMessage` uses) can serialize plain JSON
but not class instances with cyclic references. A converted `OpenAPIV3.Document`
is plain JSON — clone-safe. A parsed `GqlDocument` has class instances with
back-references — clone-unsafe. So OAS gets converted (a JSON-preserving step)
host-side, but GraphQL parsing happens worker-side. See
[the GraphQL asymmetry](../explanation/the-graphql-asymmetry.md).

**What happens if I throw in a generator's `transform`?**

`#runOasOperationGenerator` (`core/context/GenerateContext.ts:417-432`) catches
it, logs an error, and marks the operation as `'error'` in the manifest. The
rest of the run continues. Errors are scoped to one (generator × operation)
pair.

**What happens if I throw in a Projection's _constructor_?**

The throw propagates up through the Driver, then up through `insertOperation` in
the calling generator's `transform`. The catch in `#runOasOperationGenerator`
handles it. So a constructor failure becomes an operation-level error in the
same way a transform-level failure does.

**Can two generators write to the same file?**

Yes — this is the common case. The form generator and the Tanstack Query
generator both write definitions into different files, but they also both write
imports into each other's files (when forms reference hooks). The `Set`-based
deduplication in `register({ imports })` handles same-module collisions; the
`Map.has` gate in `register({ definitions })` enforces first-write-wins.
Same-name collisions from different generators throw via `affirmDefinition` on
the Driver path.

## Further reading

- [How generators produce output](how-generators-produce-output.md) —
  `GenerateContext.toArtifacts`'s iteration loop and the pull-based Projection
  model.
- [Files, deduplication, and integrity](files-and-dedup.md) — what Drivers
  register into, and the `generatorKey` integrity check on top.
- [The Worker runtime](the-worker-runtime.md) — what happens at the worker
  boundary.
- [Cross-generator coordination](cross-generator-coordination.md) — the cache
  mechanism in depth.
- [Error handling philosophy](error-handling-philosophy.md) — the manifest as
  canonical run record.
- [`reference/api/parse-context.md`](../reference/api/parse-context.md) — Parse
  API surface.
- [`reference/api/generate-context.md`](../reference/api/generate-context.md) —
  Generate API surface.
- [`reference/api/render-context.md`](../reference/api/render-context.md) —
  Render API surface.
