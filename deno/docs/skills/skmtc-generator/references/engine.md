# Engine rules

What the engine does with your producers, and the rules that a clone of
a stock generator does not show. Read the section for the work in hand.

The engine has three phases: parse, **generate** (your code runs here)
and render (`toString()` runs once for each file, only here). During
generate the output does not exist. Your code builds producers that the
engine can walk, attribute, reuse and take imports from.

## The package

Generator source code is the customization surface. Stock generators
write their export paths and their peer imports in the source, so a
clone is where you change them.

```
gen-x/  deno.json          name @scope/gen-*, @skmtc/* as caret ranges (^x.y.z),
                           lint plugin jsr:@skmtc/lint-plugin
        mod.ts             re-exports, and `export { entry as default }`
        src/mod.ts         the entry: toModelEntry / toOasOperationEntry
        src/base.ts        names and export paths, through the lang base factory
        src/enrichments.ts the enrichment schema
        src/XProjection.ts the projection: its constructor builds the value tree
        src/<router>.ts    schema type to producer
```

- Declare `@skmtc/*` dependencies as caret ranges, also where the
  source you cloned pins them exactly. An exact pin of core puts a
  second copy of core in the bundle when the project pins another one.
- Change the names and paths in `base.ts` and the classes behind the
  router. Keep the rest of the shape.

## Identity before construction

`toIdentifierName`, `toIdentifierType` and `toExportPath` are statics.
The engine computes them from the subject, the enrichments and the
variant, and it builds no producer to do so. This is how the engine
looks a definition up before it builds one, and how another generator
knows where your definition will be.

- A name depends only on what the statics receive. It never depends on
  what a constructor found.
- Models take their name from `ref.refName`, with core's `camelCase`,
  `capitalize` and `decapitalize`. Operations take theirs from the
  method and the path, with core's `toEndpointName` (`post` gives
  `Create`, `put` gives `Update`). No stock generator reads
  `operationId`.

## The cache

No plugin registry, no dependency graph, no topological sort: the cache
is the file map, keyed by identifier name and export path, and every
producer creates its own dependencies. The order of generators does not
change which files, definitions and names a run gives. Do not propose
an order, a priority or a pass before generation.

- When your code inserts a model, the engine looks the definition up.
  On a hit it reuses the definition, runs no constructor, and adds the
  import. On a miss it builds the model.
- A reference back to a model that is still under construction (a
  cycle) goes through `toModelRef`. See `model.md`.
- Two generators that claim one name at one path fail the run with
  `Registered definition mismatch`.
- **A hit is by name and path, never by input.** The cache returns
  what the first caller built, so everything your output depends on
  must be in the name or the path: the subject, the variant, the
  options. A model hit is checked against its generator key and its
  options. An inline schema is not checked at all:
  `insertNormalizedModel` reuses whatever holds `fallbackName` at that
  path, so two different inline schemas under one `fallbackName` share
  the first one's definition, with no error. Give each inline schema
  its own `fallbackName`: your identifier name plus its role (`Args`,
  `Body`, `Response`).
- **The cache lasts one run; what outlives it is a hash of your
  output.** Each run builds every file again. The CLI keeps a hash of
  each file it wrote and skips the write when the new text is the same.
  A host can store a result under a hash of the document and the stack
  (the hub does, for operation code). Both hold only when the same
  document, enrichments and generator code give the same bytes, so
  build your output from those three alone. A date, a random id, an
  environment variable or a counter in module state makes every run a
  change, and makes a stored result wrong.

## Another generator's output

A peer has two doors: the insert calls, and an API that the peer's
package exports.

- `insertModel(Peer, ref)` returns an **`Inserted` handle**. The name
  is `.toName()` and the definition is `.definition`.
- `insertNormalizedModel(Peer, { schema, fallbackName })` returns the
  **definition**. The name is `.identifier.name`.
- To know a peer's name and path and build nothing, call
  `context.toModelContentSettings`.
- Import a peer's projection through its package name
  (`@skmtc/gen-zod`), never through a relative path.
- The engine writes the import for what you insert. You write no import
  for a peer.

What the insert gives you is the convention: the name, the file, the
form of the declaration. When it is not what you want:

1. Do not call the peer's `toIdentifierName`, `toExportPath` or
   `toEnrichments`, and do not build a `ref` from a string of your own.
   Attribution, enrichment routing and recursion all key on real refs.
2. Do not render a wider type for a shape you know
   (`Map<String, Any?>` for a known object).
3. Find how other code generators solve the same case. The usual
   answer is to make a named declaration and refer to it by name: look
   it up with `context.findDefinition`, and make it with your lang
   package's `defineAndRegister`.
4. Derive that name from the schema's own `stackTrail`, where you need
   it. `components/schemas/Order/properties/metadata` gives
   `OrderMetadata`. A trail that starts at an operation uses the
   operation's name (`CreateApiOrdersBody`). Start from `components` or
   `paths`, because the head of the trail holds frames that change with
   each run. Throw on a trail you do not know.
5. If the solution needs something the engine lacks, stop and report
   the gap. Do not write the engine's part in the generator.

## Two shapes of generator

- **Projection.** One definition for each subject. The entry calls
  `insertModel` or `insertOperation`.
- **Accumulator.** Many subjects add to one definition. The entry does
  `context.findDefinition(…) ?? defineAndRegister(context, { … })` and
  then calls a method on the value that holds the items. That method is
  the one exception to "a constructor and `toString()`".
  `defineAndRegister` is a function of your lang package. Clone
  `@skmtc/gen-msw` or `@skmtc/gen-express`.

## Variants

The variant axis fans out at the engine, not the generator. One subject
can give several definitions through variants that the consumer
declares in enrichments. `'main'` is always present.

- Take `variant` in `transform({ context, operation, variant })` and
  pass it to `insertOperation`.
- Put it in names with `withVariant`.
- A variant that is not passed on makes every variant `'main'`, and the
  second fails with `Registered definition mismatch`.

## Enrichments and options

**Enrichments** are settings that the document cannot give. The
consumer writes them in `skmtc.config.json`. Its old name,
`client.json`, still works, and the CLI reports it as deprecated.

- Declare them in `enrichments.ts` as a valibot schema with three
  scopes: `subject`, `generator` and `stack`. That schema is all a
  consumer can set.
- A generator with none exports
  `toEnrichmentSchema = () => emptyEnrichmentSchema`: a function, in
  the entry config and in the base factory config.
- Read the subject scope as `this.settings.enrichments.subject`. Read
  the other two outside a projection with `toGeneratorEnrichment` and
  `toStackEnrichment`. Their `skmtc.config.json` keys are `[id]._generator`
  and `[id]._stack`.
- Declare each scope you read. A scope left as `v.undefined()` rejects
  any value at its key, so `_stack` needs every generator of the run to
  declare `stack`. Most stock generators declare `subject` only.
- A value of the wrong type fails the run, and the message names its
  place in `skmtc.config.json`. Keys that the schema drops are listed in
  `manifest.enrichmentWarnings`.

**Options** come from the generator that calls you, on the insert:
`this.insertModel(Peer, ref, { options: { suffix: 'Input' } })`.

- A projection declares its options type as the second type parameter
  of its base factory (`toTsModelProjectionBase<E, Options>`). The
  statics and the constructor receive them, and the instance stores
  them as `this.options`.
- Options are identity. When the output depends on them, put them in
  `toIdentifierName`, or a second insert with other options fails with
  `Registered definition mismatch`.
- `{ options }` is required when the peer declares options, and a type
  error when it declares none. Declare `T | undefined` to make it
  optional. Pass a new object on each insert.
- State in a module is never a channel between generators.

## A model is a `ref`

`ref` is `{ refName, refPath }` (`RefParts`). `refName` is the last
part of the pointer, and `refPath` is the pointer before it:
`#/components/schemas` for a component, something deeper for a ref into
a `$defs` entry, a property or `#/paths/…`. An `OasRef` fits it as it
is.

- Every model API takes the whole `ref`: `insertModel(Peer, ref)`,
  `toModelRef({ …, ref })`, `context.resolveSchemaRefOnce(ref)`,
  `toIdentifierType(ref, context)`, and the `ref` key of the statics,
  `isSupported`, `transform` and the projection constructor
  (`this.ref`).
- Core keys a deep ref's model by its whole pointer. The name is yours,
  and `ref.refName` alone repeats across positions (two
  `…/properties/disk`).
- When you hold only a component's name (from `toSchemasRefNames()`),
  `toSchemaComponentRef(refName)` gives its `ref`.

## Construction, render and failure

- A producer registers its imports in its constructor.
- `toString()` is a method on the class. An arrow function in a field
  breaks attribution.
- A throw fails the run. The engine records the error on that subject,
  runs the others so that the `RUN_FAILED` issue lists each failure,
  and writes no files. The parser accepts faults in a document.
  Generate does not accept a bug in a generator or a wrong enrichment
  value.

## Read the types, and check against the run

- `OasSchema` is a union type, not a class hierarchy. Each member has
  `.isRef()` that returns `false`. `OasRef` is beside the union, with
  `.isRef()` that returns `true`.
- The parser merges an `allOf`, except a `$ref` that closes a cycle.
  That schema is an `OasIntersection` (`type: 'intersection'`), and the
  references it keeps are in `members`.
- Generation takes less than a second. Run it after each change, and
  read in this order: the manifest (the definitions you expect, at the
  paths you expect, parse issues, errors on a subject); then one
  output file, import header first; then `deno lint`; then, when you
  use a peer, that its definition is there once and your file imports
  it.

## The language layer

The engine is language-blind; the import graph declares the language. A
generator imports its base factories and its snippet base from a lang
package, and the engine reads the language off the projection class.
Base factory names, snippet classes, identifier factories and import
rules are in `typescript.md`.

GraphQL SDL input exists (`toGqlOperationEntry`, with subjects routed by
`[rootKind][fieldName]`), and these rules apply to it. Its entry, its
enrichment routing and its base factories are not covered here.

## Pitfalls

| Symptom | Fix |
|---|---|
| An import is missing, or is in the middle of a file | Register it. A string held a producer |
| A shared model has two definitions | Refer to the peer through `insertModel`, not by its name |
| `Registered definition mismatch` | Pass `variant` on. Or two generators claim one name and path |
| `Registered definition mismatch` that names `Cached options` | The peer's output depends on its options and its name does not. Put the options in `toIdentifierName` |
| A peer's name is wrong in your output | Read `.identifier.name` or `.toName()` from the result of the insert |
| `insertResult.identifier` is a type error | You hold an `Inserted` handle from `insertModel`. Use `.toName()` or `.definition` |
| It works once and fails on recursion or on a ref | Build the tree in the constructor, and take references from `toModelRef` |
| An enrichment has no effect | The routing key does not match. Read `manifest.enrichmentWarnings` |
| Edits to the output are gone | Change the generator |
| The router sends a custom value to the wrong class | `schema.type === 'custom'` is a real case of the router |
| `null` passes a guard for an optional value | `!== undefined` lets `null` pass. Test both |
| A `ref` built from a string of your own | Use the peer's two doors |
| `DanglingRefError` from `insertModel`, `resolve()` or an accessor such as `toParams()` | A `$ref` names nothing, and `settings.parse.danglingRefs` (old name `settings.system`, deprecated) lists its kind. Catch it where you insert or resolve that kind (for parameters, resolve each entry of `operation.toEffectiveParameters()`), test it with `DanglingRefError.is(error)` (your bundle can have another copy of core, so `instanceof` can be false), throw any other error again, and render a fallback or fail the item. By default (`[]`) the parser removes what holds such a `$ref`, and you do not see it |
| Your code reads fields of a peer's value other than its definition and name | Those fields are private to the peer and change without notice |
| An inline schema renders as another schema's definition | Two `insertNormalizedModel` calls share a `fallbackName` at one path, and the second got the first one's definition — name each from your identifier name plus its role |
| Every file is written again on a run that changed nothing | The output reads a clock, a random value, the environment or module state — build it from the document, enrichments and generator code alone |
