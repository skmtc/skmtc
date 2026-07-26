---
name: skmtc-generator-v2
version: 0.1.0
description: |
  Author and edit SKMTC generators — Projection classes, Snippets,
  transform functions, enrichment schemas, and the customization seams
  in cloned stock generators. Teaches the generation model first:
  the three-phase lifecycle (parse, generate, render), code as
  Stringable object trees, dependencies declared at construction and
  settled by the engine, and Files as the cache that makes generation
  idempotent and order-independent.

  Use this skill when the user asks to "write a skmtc generator",
  "author a generator", "clone gen-x", "customize gen-x", "add a field
  type", "swap the HTTP layer", "change export paths", "add enrichment
  options", "compose generators", or edits a `.ts`/`.tsx` file under
  `<root>/.skmtc/<project>/<gen-name>/`. Defer to `skmtc-cli-v2` for
  install/clone/bundle commands themselves. Defer to `skmtc-debug` when
  the generator's output is broken and the cause isn't yet known.
  Pair with `skmtc-lang-typescript` or `skmtc-lang-kotlin` for the
  target-language layer — load the lang skill for whichever language
  the generator emits.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Write
  - Edit
---

# SKMTC generator authoring

SKMTC turns an API schema (OpenAPI v3 or GraphQL SDL) into source code.
A generator is a package that tells the engine what to make from each
schema subject — a Zod validator per model, a Kotlin data class per
model, a fetch function per operation. You author generators; the
engine owns everything else: parsing, scheduling, dependency
settlement, file assembly.

This skill teaches the mental model. SKMTC has almost no training-data
presence, so the model in your head is the one this document builds —
and most operational rules follow from it rather than needing to be
memorized. Mechanical rules are enforced by the linter and the
project's checks; when a diagnostic fires, its hint text is the rule.
When you face a decision this document doesn't cover, reason from §1
and §2 rather than from what codegen usually looks like — SKMTC is
deliberately unlike typical codegen, and imported habits are the main
source of broken generators.

## 1. The three-phase lifecycle

Every run is three phases, strictly ordered. Each phase has a
different shape, and knowing which phase you are writing for tells you
what kind of code to write.

**Parse.** The engine parses the schema into typesafe
intermediate-representation objects — `OasDocument`, `OasOperation`,
the `OasSchema` union, `GqlOperation`. Generators never see raw
JSON/YAML; they read the IR. You don't write parse-phase code.

**Generate.** The engine walks every (generator × subject × variant)
combination and calls your entry's
`transform({ context, refName | operation, variant })`. This is where
all generator code runs — and none of it produces text. What it
produces is **topology**: you instantiate producer objects, and each
producer, in its constructor, builds the object tree for the code it
represents — taking its subject apart, instantiating child producers
for the parts, declaring the dependencies and imports it needs, and
registering itself into a File. When Generate finishes, the entire
output — every file, every definition, every import — exists as one
settled object graph. No source text exists yet.

**Render.** Only now does text appear. The engine calls `toString()`
on each File, and the call cascades: the File stringifies its imports
and Definitions, each Definition stringifies its value, each value
stringifies the child producers embedded in its template literals,
down to the leaves. The whole tree collapses into source text in one
pass. Render-phase code — every `toString()` you write — is a **pure
read of settled state**: no construction, no registration, no
decisions. Everything was already decided during Generate; `toString()`
just reports it.

Two consequences are worth holding explicitly, because they pull in
opposite directions from ordinary instincts:

- **Construction is deliberately stateful.** A producer's constructor
  saves its inputs, instantiates child producers, and registers things
  into context. That is not a code smell here; it is the design. The
  constructor is where a producer participates in building the
  topology, and the engine's guarantees (§4) exist precisely because
  all declaration happens inside constructors during Generate.
- **The pipeline as a whole is a pure function.** Schema + settings
  in, identical artifacts out, every time, regardless of generator
  order. The statefulness is contained inside one phase and settles
  completely before Render reads it.

Hold both shapes at once, and know which side of the boundary the code
you are writing sits on: constructors build and declare; `toString()`
only reads.

Why this architecture instead of writing text directly? Because until
Render, everything about the output is still an object you can reach
into. A union parent can splice a discriminator parameter into a
member's already-built parameter list; a second generator can import a
definition a first generator created; an enrichment can rename an
identifier — all because the parameter list, the definition, and the
identifier are still live objects with accessible properties, not
characters in a string. String output has no topology: once code
collapses to text, nothing can attach to it, reference it, or adjust
it. That is why the collapse happens once, at the very end, engine-
driven — and why reaching for early stringification is the
characteristic way generators go wrong (§2, §7).

## 2. Unlearn this

SKMTC contradicts several habits that are correct almost everywhere
else. Each row names the habit, what is true here instead, and why.
When generator code feels awkward to write, check this list first —
the awkwardness is usually one of these priors asserting itself.

**"Codegen means building strings."**
Here, codegen means building a tree of objects that each know how to
print themselves, and letting the engine collapse the tree at Render.
You will write template literals — but their interpolated slots hold
producer objects (`${this.value}`), and the literal is inside a
`toString()`. The difference matters because interpolation calls the
child's `toString()` *at render time*, preserving the cascade; gluing
pre-stringified fragments together during Generate destroys the
topology the engine and other producers still need (§1, §7).

**"Constructors should be side-effect-free."**
Here the constructor is exactly where side effects belong: instantiate
children, insert dependencies, register into a File. The inverse holds
too: `toString()`, which looks like the "doing" method, must be pure.
The usual discipline — construct passively, act in methods — is
inverted, on purpose, because the engine's ordering guarantees are
built from the fact that all declaration happens at construction time
and all reading happens after everything is settled.

**"Check whether it exists before creating it."**
Never. Insertion is memoized on `(identifier.name, exportPath)`:
however many producers declare the same dependency, in whatever order,
exactly one instance exists, and every declarer gets a handle to it.
Defensive `if (!alreadyRegistered)` checks, existence probes before
`insert*`, and deduplication passes are all re-implementations of a
guarantee the engine already provides — dead weight at best, a source
of divergence at worst. Declare what you need where you need it; the
engine owes you the rest.

**"Manage the order — dependencies first."**
There is no run order to manage. No dependency graph, no topological
sort, no "run gen-X before gen-Y", no pre-generation pass — and none
of these is missing; they are unnecessary by construction. When your
constructor inserts a dependency, the engine builds and registers that
dependency synchronously, before your own registration completes — so
anything you depend on is always settled into its file ahead of you
(§4). Whatever order generators or subjects are visited in, the output
is complete and identical.

**"Start small and simple; extend it later."**
Good advice everywhere else; the trap here. The incremental instinct
says: this fragment is small, a string is simpler, promote it to a
producer if it grows. But composition cannot be retrofitted onto a
string — the moment a fragment stringifies early, everything that
later needed to reach into it (a parameter to splice, an import to
attach, a name to reference) finds text instead of an object, and the
fix means rebuilding the fragment as a producer anyway, now under
pressure. The cost asymmetry is stark: a producer that never needed to
be one costs a few lines; a string that needed to be a producer breaks
the chain of everything built on top of it. **When in doubt, assume it
will be built upon.** §7 covers the narrow cases where a plain string
is genuinely right.

## 3. Producers and the Stringable contract

The entire composition system rests on one type:

```ts
// core/dsl/Stringable.ts
export type Stringable = {
  toString: () => string
}
```

A **producer** is an object whose `toString()` emits target-language
code. Any field typed `Stringable` accepts a string, a Snippet, a
Definition, an `Identifier`, or an inserted handle interchangeably —
and template-literal interpolation calls `toString()` automatically,
at render time. That is the whole mechanism: producers hold other
producers in `Stringable`-typed fields and interpolate them in their
own `toString()` template; the engine triggers the top of each file
and the tree collapses.

Producers come in two kinds, and choosing between them is a question
about identity:

- A **Projection** is a producer with file-scope identity — a name, an
  entity kind, an export path. The engine instantiates it (directly
  from a `transform`, or on demand through `insert*`), wraps it in a
  Definition, and lands it in a File as `export const X = ...` /
  `data class X(...)` / the language's equivalent. Other code can
  import and reference it.
- A **Snippet** is a fragment with no identity of its own — a
  parameter list, an annotation, a type expression. Its parent
  constructs it directly (`new MyFragment({ context, ... })`) and
  interpolates it. It renders inline wherever it is embedded. Snippets
  are how a generator splits into small, reusable, independently
  testable units; a generator that is one giant `toString()` has
  under-used them.

Both kinds follow the same two-member discipline: a constructor that
builds and declares, a `toString()` that reads. Producers carry no
other public methods — a producer needing a third method is usually
two producers.

**Properties stay live until Render — that is the payoff.** Because a
constructed producer is an object, not text, its parts remain typed,
reachable fields: a data-class value exposes its `parameters` array,
its `annotations` array. Whoever holds the object can still adjust it
during Generate. The canonical example is union membership: a `oneOf`
parent, constructing after its members, reaches into each member's
already-built parameter list to splice in the discriminator-tag
parameter and registers the subtype annotations on the parent — no
member re-render, no text surgery, because there is no text yet.

When a projection and its value expose the same collection, they
**share the reference** — one array, two names:

```ts
this.value = toKtValue({ ...args })
this.annotations = this.value.annotations
```

Never copy, never mirror through a getter, never reassign after
aliasing — sharing means both holders see every later mutation (such
as that discriminator splice); a copy silently forks the state.

And never fake the contract: `{ toString: () => '...' }` satisfies
`Stringable` while lying about capabilities. A stringable fragment is
a Snippet.

## 4. Dependencies: declare at construction, the engine settles them

When a producer needs a peer's output — a model type for a parameter,
a validator for a response — it does not look it up, schedule it, or
check for it. It **inserts** it, at the moment of need, in its
constructor:

```ts
// instance methods on every projection base:
this.insertModel(PeerProjection, refName)
this.insertNormalizedModel(PeerProjection, { schema, fallbackName })
// from a transform, the same operations live on context:
context.insertModel(PeerProjection, refName)
```

The insert call runs the peer's **full lifecycle synchronously**
before it returns: check the destination File for an existing
definition under the peer's `(identifier.name, exportPath)`; on a
miss, construct the peer (which may recursively insert its own
dependencies), wrap it in a Definition, and register it into its
File; on a hit, verify it and reuse it. Either way, by the time your
constructor resumes, the dependency is settled — and since your own
registration happens after your constructor's inserts, a same-file
dependency is always registered, and therefore rendered, above you.

`insertModel` / `insertOperation` return an `Inserted` handle, with
the peer still reachable as an object:

```ts
// core/dsl/Inserted.ts
class Inserted<V, EnrichmentType> {
  settings: ContentSettings<EnrichmentType>
  definition: GeneratedDefinition<V>
  toName(): string
  toIdentifier(): IdentifierBase
  toExportPath(): string
  toValue(): V
}
```

`insertNormalizedModel` is the exception: it returns the
`DefinitionBase` directly — read the name off `.identifier.name`;
there is no `toName()` on it.

Four guarantees follow, and every one of them is a thing you must NOT
re-implement:

- **Existence** — an inserted dependency is built if absent. No
  pre-passes, no "make sure gen-X ran".
- **Uniqueness** — insertion is memoized on
  `(identifier.name, exportPath)`. However many producers declare the
  same dependency, in whatever order, exactly one instance exists. No
  existence checks, no deduplication.
- **Placement** — a same-file dependency renders above its dependent
  (registration order is render order — Files hold definitions in an
  insertion-ordered Map); a cross-file dependency gets the import
  stitched into the destination automatically. No sorting, no
  hand-wired imports for inserted peers. Pinned by
  `core/context/GenerateContext.placement.test.ts`: both schema
  orders put the dependency above the dependent.
- **Settlement** — all declaration happens during Generate; Render
  starts only after Generate completes, so every `toString()` is a
  pure read of settled state. Never insert or register at render
  time.

Two operational notes. `insert*` enforces the peer projection's
`isSupported` — inserting an unsupported subject is an error at the
declaration site, not a silent gap downstream. And a cache hit is
verified: if a registered definition under your requested name was
produced by a different generator identity, the engine throws
`Registered definition mismatch` — the fix is always in identity
config (names, export paths), never a hand-rolled dedupe.

## 5. Files: the cache everything lands in

A File object plays two roles, one per phase.

**During Generate it is a memo table.** Every `insert*` call checks
the File keyed by `(identifier.name, exportPath)` first; a hit
returns the already-registered Definition, a miss constructs on the
spot. `context.findDefinition({ name, exportPath })` reads the cache
without constructing. This one mechanism is why generation is
**idempotent** (declaring the same thing twice is a no-op),
**order-independent** (any generator/subject order converges on the
identical object graph), and **fast** (shared subtrees are built
once, however many producers depend on them).

**At Render it is the unit of output.** Each File serializes itself:
imports header first (deduplicated and merged per module — every
`register({ imports })` from every producer accumulated into one
block), then its Definitions in registration order. One
`file.toString()` call per file; artifacts out.

The primitive underneath is `register`: pure data into the File —
`{ imports?, reExports?, definitions?, custom? }` plus a destination
path. Projections default their destination to their own
`settings.exportPath` (`this.register({ ... })`); Snippets have no
settings and always pass `destinationPath` explicitly. Files are
created on first write; a path is a claim, not a prerequisite.
(`registerJson` / `registerMarkdown` exist on context for non-code
artifacts.) Never write to disk yourself — `Deno.writeFileSync` puts
a file on disk but not in the engine's file map, so it is invisible
to the cache, the manifest, and the render phase.

Step back and the whole model compresses to one sentence: **all
generator activity, directly or indirectly, takes a subject,
instantiates a producer with it, and writes it into a File** — 
`transform` does it for top-level subjects, `insert*` does it
recursively for dependencies, `register` is the primitive that lands
each one. If code you are writing doesn't reduce to that sentence,
check §2 — a prior is probably steering.

## 6. Generator anatomy

A generator package has a thin shell and a producer core.

**`mod.ts` — the entry.** Declares what the generator handles and
maps each subject to a top-level projection. Verbatim shape (from the
core factories `toModelEntry` / `toOasOperationEntry`; GraphQL and
webhook twins exist):

```ts
import { toModelEntry } from '@skmtc/core'
import { MyModel } from './MyModel.ts'

export const myGenEntry = toModelEntry({
  id: 'my-gen',
  transform: ({ context, refName }) => {
    context.insertModel(MyModel, refName)
  }
})
```

Entries optionally add `isSupported` (subject filter),
`supportsVariant` (variant opt-in), `toEnrichmentSchema` /
`toEnrichmentDefaults` (valibot schema for per-subject config).
`transform` returns void — its job is to insert, nothing else.
Entries carry no language: the language enters through the import
graph, via the base the projections extend.

**The base file — language and identity.** Each lang package exports
companion factories — `toTsModelProjectionBase`,
`toKtOasOperationProjectionBase`, and so on — that take a config
object and return a class to extend. The config *is* the projection's
identity; the factory installs these as statics on the returned base:

```ts
// core/dsl/model/toModelProjectionBase.ts
export type ModelProjectionBaseConfig<EnrichmentType, IdType> = {
  id: string
  toIdentifierName: (args: { refName, enrichments, variant }) => string
  toIdentifierType: (refName: RefName, context: GenerateContextType) => IdType
  toExportPath: (args: { refName, enrichments, variant }) => string
  toEnrichmentSchema: () => v.GenericSchema<EnrichmentType>
  toEnrichmentDefaults?: (args: ToEnrichmentsArgs) => EnrichmentType | undefined
  isSupported?: (args: { refName: RefName; context: GenerateContextType }) => boolean
}
```

This is where a projection sets its own identifier name, entity kind,
and export path — and these are the **customization seams**: cloning
a stock generator to change where output lands or what it is called
means editing these config functions, nothing deeper. They are also
the cache-key source (`toIdentifierName` runs on every cache check —
keep it pure and cheap). The lang skill for your target language
carries the verbatim wiring scaffold; do not write a base file from
memory.

**The projection** extends the base, takes
`{ context, settings, refName }` (operations:
`{ context, settings, operation }`), builds its value tree in the
constructor, registers itself, and renders in `toString()`. The
`settings: ContentSettings<E>` it receives is the engine's answer to
its own static config — identifier, exportPath, parsed enrichments,
variant — computed by the Driver before construction. Read config off
settings/context at the point of need; never thread config through
the value tree.

**Model generators route through one dispatch site.** A
model-emitting generator has exactly one place that looks at
`schema.type`: the router (`SchemaToValueFn` — schema in, typed value
out, one case per schema type, each case its own module). Everything
else — annotations, defaults, format forks — is decided *inside* the
per-type case that owns it and exposed as fields on the value it
returns. A `schema.type` check anywhere else, or a second dispatch,
is the axiom violation the structural checks reject. Format forks
choose between snippets (each rendering exactly one target-language
type); branches inside a snippet only vary the rendering of that one
type.

**Variants** partition a generator's output per subject (`variant`
threads through identity args and settings); **enrichments**
parameterize it (schema-validated per-subject config arriving parsed
on `settings.enrichments`). Partition vs parameterize — if two
consumers want structurally different output, that is a variant or a
clone, never a config flag.

**The silhouette of a finished generator:** a thin `mod.ts`, a base
file of config, and otherwise Projections and Snippets — constructor
plus `toString()` each — with one router if it emits models. Helper
functions are rare and small; classes that are not producers are
rarer. If your file tree doesn't look like that, revisit §2.

## 7. The string-concatenation default

You will constantly feel the pull to just build a string — it is the
locally easy move, and for the one fragment in front of you it would
even work. The boundary question is: **will anything ever need to
reach into this — attach to it, reference it, adjust it?** If yes, it
must be a producer; a string has no inside. The honest answer is that
predicting "will anything attach later" is exactly the judgment that
fails under pressure, so do not rely on the prediction. Rely on the
cost asymmetry:

> A producer that never needed to be one costs a few extra lines. A
> string that needed to be a producer severs the chain — everything
> that would have composed with it must be rebuilt. **When in doubt,
> assume it will be built upon.**

There is a legitimate string zone, and it is precisely the places
that are strings *by contract*, not code:

- `toIdentifierName` / `toExportPath` return names and paths — plain
  string manipulation is correct there.
- Sanitization and casing helpers operating on names.
- Leaf literals inside a producer's own `toString()` template — the
  keywords and punctuation between the interpolated slots.

Inside `toString()`, compose by **interpolating `Stringable`s** —
`` `data class ${this.identifier}(${this.parameters})` `` — never by
concatenating pre-rendered fragments during Generate. Interpolation
defers the child's `toString()` to render time, preserving the
cascade; a fragment stringified during Generate has already left the
object world.

## 8. Core types

Verbatim from source (paths relative to the framework repo's
`deno/`). These plus the lang package's types are the authoring
surface; when you need a shape not listed here, read the source at
these paths — never guess a signature.

```ts
// core/dsl/Stringable.ts
export type Stringable = { toString: () => string }

// core/dsl/GeneratedValue.ts — what Definitions wrap
export type GeneratedValue = Stringable & { generatorKey?: GeneratorKey }

// core/dsl/ContentSettings.ts — what a projection receives as `settings`
export class ContentSettings<EnrichmentType = undefined> {
  identifier: IdentifierBase
  exportPath: string
  enrichments: EnrichmentType
  variant: string
}

// core/dsl/model/toModelProjectionBase.ts — projection constructor args
export type ModelProjectionArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  settings: ContentSettings<EnrichmentType>
  refName: RefName
}
// operations: { context, settings, operation: OasOperation }
// (core/dsl/operation/oas/types.ts)

// lang-typescript/src/register.ts — the register payload (Kt analogous)
export type TsRegisterArgs = {
  imports?: Record<string, ImportNameArg[]>
  reExports?: Record<string, TsIdentifier[]>
  definitions?: (DefinitionBase | undefined)[]
  custom?: Stringable
}

// core/context/generateTypes.ts — context surface generators touch
insertModel(projection, refName, options?): Inserted<V, EnrichmentType>
insertNormalizedModel(projection, { schema, fallbackName, destinationPath }, options?)
insertOperation({ projection, operation, ... }): Inserted<V, EnrichmentType>
findDefinition({ name, exportPath }): DefinitionBase | undefined
register({ imports?, reExports?, definitions?, custom?, destinationPath })
registerJson({ destinationPath, json })
registerMarkdown({ destinationPath, markdown })

// core/types/TypeSystem.ts — the model router contract
export type SchemaType = OasSchema | OasRef<'schema'> | OasVoid | CustomValue
// CustomValue (core/dsl/CustomValue.ts): a generator-made Stringable
// standing in for a schema — routes to the router's 'custom' case
export type TypeSystemArgs<Schema extends SchemaType> = {
  context: GenerateContextType
  destinationPath: string
  schema: Schema
  rootRef?: RefName
  required: boolean | undefined
}
export type SchemaToValueFn = <Schema extends SchemaType>(
  args: TypeSystemArgs<Schema>
) => TypeSystemOutput<Schema['type']>
// TypeSystemValue = TypeSystemArray | TypeSystemObject | TypeSystemUnion
//   | TypeSystemString | TypeSystemNumber | TypeSystemInteger
//   | TypeSystemBoolean | TypeSystemUnknown | TypeSystemVoid
//   | TypeSystemNever | TypeSystemRef | TypeSystemNull | TypeSystemCustom

// core/types/Enrichments.ts
export type EmptyEnrichments = v.InferOutput<typeof emptyEnrichmentSchema>
```

One trap worth naming here because it recurs: several OAS IR fields —
`OasObject.properties`, `enums`, `default`, `example` — are
Nullable-generic (`T | null | undefined`). A presence guard must
clear the `null` arm too: use truthiness (`if (schema.properties)`),
not `!== undefined`.

## 9. Working method, verification, boundaries

**Method.** Write a short plan before code (which producers, which
files, what the router cases return). Scaffold via the CLI rather
than from memory, and extend the scaffold — it encodes the current
canon. Do not audit engine source to re-derive what §1–§5 state;
read framework source only for a concrete signature you need.

**Verify mechanically, not by re-reading.** Type-check from the
project root in a subshell —
`(cd .skmtc/<project> && deno check <gen>/mod.ts)` — and lint:
scaffolded generator projects carry `@skmtc/lint-plugin` in their
`deno.json`, so `(cd .skmtc/<project>/<gen> && deno lint)` reports
doctrine violations (construction in `toString()`, dispatch outside
the router, redundant ref guards, …) with the rule text in each
hint. Findings are doctrine — fix them, never suppress them. Run
whatever additional checker the workspace provides (an eval
workspace ships a runnable grader; its output is authoritative
feedback, not a prompt to read the checker's source). Then generate
and read the actual output; the emitted code is the ground truth the
object tree was building toward.

**Boundaries.** CLI commands (install/clone/bundle/generate
mechanics) → `skmtc-cli-v2`. Broken output with unknown cause →
`skmtc-debug` (verify-first). The target language's rendering layer —
file/import model, identifier factories, wiring scaffolds, syntax
helpers — → `skmtc-lang-typescript` / `skmtc-lang-kotlin`; load the
lang skill alongside this one for any authoring task. GraphQL-source
generators additionally → `skmtc-graphql`.

**On demand.** Two sibling files, read when their trigger fires:
- `common-errors.md` — the recurring wrong guesses and their
  corrections; read it when a diagnostic surprises you or before
  debugging output that looks almost right.
- `appendix.md` — generated, authoritative signatures. Read it the
  moment you need the exact fields of an OAS input class
  (`OasObject`, `OasString`, `OasUnion`, `OasDiscriminator`, `OasRef`,
  `CustomValue` — `additionalProperties`, `members`, `mapping`, and
  the rest) or a contract type's field shapes (`TypeSystemUnion`,
  `TypeSystemRecord`, `Inserted`) — instead of diving into framework
  source.

<!-- api-appendix:begin — GENERATED, do not edit by hand -->

## Appendix — generated API reference

The full `deno doc` surface for the packages this skill covers lives
in [`appendix.md`](appendix.md), in this skill's directory —
generated from framework source at `71ef53bc`, signatures and
field docs only. It is **authoritative**: when the prose above does
not carry the exact constructor or field shape you need, Read (or
grep) `appendix.md` instead of diving into package source. Do not
guess signatures. For a symbol not listed there,
`deno doc <file> <Symbol>` against the framework source beats
grepping it.

<!-- api-appendix:end -->
