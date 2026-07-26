---
name: skmtc-generator
version: 0.12.0
description: |
  Author and edit SKMTC generators — write or modify Projection
  classes, Snippets, transform functions, enrichment schemas, and the
  customization seams in cloned stock generators. Covers the
  generation model (producers, Definitions, Files-as-cache), the DSL
  (Projection vs Snippet, ContentSettings), cross-generator
  coordination via memoization, and the operational rules that
  override default TypeScript / codegen intuitions imported from
  training data.

  Use this skill when the user asks to "write a skmtc generator",
  "author a generator", "clone gen-x", "customize gen-x", "add a field
  type", "swap the HTTP layer", "change export paths", "add enrichment
  options", "compose generators", or edits a `.ts`/`.tsx` file under
  `<root>/.skmtc/<project>/<gen-name>/`. Defer to `skmtc-cli` for
  install/clone/bundle commands themselves. Defer to `skmtc-debug` when
  the generator's output is broken and the cause isn't yet known —
  verify-first stance takes priority during diagnosis. Pair with
  `skmtc-lang-typescript` for the TypeScript-output layer (type-only
  imports, syntax helpers, sanitization) — load both when authoring a
  TypeScript-emitting generator.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Write
  - Edit
---

# SKMTC generator authoring

Author and edit SKMTC generators idiomatically. §1 is the generation
model — the story every other rule in this skill falls out of.
Internalize it first; the rules in §4 then read as consequences, not
as arbitrary conventions. The most common failure mode in LLM-assisted
generator authoring is importing well-intentioned TypeScript / codegen
conventions from training data that conflict with this model.


**On-demand companions** — the prose in this skill is exact and
complete for what it shows; these carry the depth. Read them when
their trigger fires, not before:

| Companion | Read when |
|---|---|
| [`appendix.md`](appendix.md) | you need an exact signature or field type the prose does not show |
| [`task-cards.md`](task-cards.md) | starting a multi-step job (cloning, barrel, accumulator, field type, peer swap) |
| [`variants.md`](variants.md) | the consumer's `client.json` declares variants beyond `main` |
| [`references.md`](references.md) | you want concept deep-dives or the enforcement-test index |
| `skmtc-graphql` skill | the input schema is GraphQL SDL |
| `skmtc-lang-<x>` skill | ALWAYS — load your target language's skill alongside this one; it owns the wiring scaffolds and emitted-code rules |

## 1. The generation model

### The two axioms

Two axioms generate every rule in this skill. Hold them and the rest
follows; violate either and you are outside the framework.

**Axiom 1 — the mapping.** A generator is a total mapping from IR
nodes to producers. A schema node (`OasSchema` / `OasRef<'schema'>` /
`CustomValue`) becomes output through exactly two doors: a named
schema through `insertModel` / `insertNormalizedModel` (→ a
Projection, built by the engine's Driver), everything else through
the generator's single schema→value function (typed
`SchemaToValueFn` → a Snippet). Composites route their children back
through the same function. There is no third door — no `schema.type`
conditional outside the router, no producer that dispatches for a
subset of types, no case handled "outside the mapping". Unmapped
types fail loudly at the router. (Scope: the axiom governs *value
production*. The mapping's metadata policies — `toIdentifierType`
choosing a declaration kind, an `isSupported` gate — may inspect
`schema.type`; they decide what a node is called or whether it is
handled, never what renders it.)

**Axiom 2 — the dependencies.** Every producer declares its own
dependencies at the moment it is constructed: peer definitions
through the two doors, imports through `register` (or a
self-registering leaf like `TsHeritage` / `KtAnnotation`). Placement
is the engine's job, and it comes with guarantees:

- **Existence** — a dependency you insert is built synchronously
  inside your constructor; its handle (`.toName()`, interpolation)
  is valid immediately.
- **Uniqueness** — insertion is memoized on `(identifier.name,
  exportPath)`; however many producers declare the same dependency,
  in whatever order, exactly one instance exists.
- **Placement** — a dependency landing in your own file was
  registered before you and renders above you; one landing in
  another file lands at its own `toExportPath`, and the import into
  your file is registered automatically (deduped and
  same-package-suppressed by the File). Pinned by
  `core/context/GenerateContext.placement.test.ts`.
- **Settlement** — all declaration happens during generate; render
  starts only after generate completes, so `toString()` is a pure
  read of settled state. This is why visit order cannot matter
  (pinned by `GenerateContext.insert-mutation.test.ts`), and why a
  producer must never insert or register at render time.

The author's side of the bargain: never sort definitions, never
forward-declare, never hand-wire an import for an inserted peer,
never check whether something "already exists". Declare what you
need where you need it; the engine owes you the rest.

### The pipeline

SKMTC generation, start to finish — every step an instance of the
axioms:

1. **Parse.** The engine parses the API schema (OpenAPI v3 or GraphQL
   SDL) into typesafe intermediate-representation objects —
   `OasOperation`, the `OasSchema` union, `GqlOperation`. By the time
   a generator sees a schema, `allOf` is already merged; `$ref`s are
   lazy (`OasRef`, resolved on demand with `.resolve()`).

2. **Loop.** The Generate phase walks `(generator × item × variant)`
   and calls each generator entry's
   `transform({ context, operation | refName, variant })` per item.
   `transform` returns `void` — the engine does nothing with a return
   value. Everything a generator produces, it produces by side effect
   on `context`.

3. **Produce.** A generator converts each incoming IR object into a
   **producer** — a *Projection* or a *Snippet* — through axiom 1's
   two doors: `context.insertOperation` / `insertModel` from
   `transform` for named items, the generator's `SchemaToValueFn`
   router for every inline schema node a producer touches. The
   producer, not string manipulation, is the unit of work: you build
   output by constructing and composing producers.

4. **Definitions in Files.** A Projection's value is wrapped in a
   **Definition** — essentially a key and a value. The key is an
   identifier (a variable or type name); the value is whatever gets
   assigned to it. Definitions are written into **File** objects: an
   object of keyed maps `{ imports, definitions, reExports }`, where
   `definitions` maps identifier name → Definition.

5. **Files have two roles.**
   - **Render unit:** at the Render phase each File serializes to
     source text — imports header, then
     `export const <key> = <value>` (or the language's equivalent)
     per Definition. Output is unformatted by design; Render does not
     run Prettier or Biome — consumers format separately.
   - **Cache:** during Generate, the File's keyed maps double as a
     memo table. Every `insert*` call checks
     `(identifier.name, exportPath)` first — a hit returns the
     already-registered Definition; a miss constructs the producer on
     the spot. `findDefinition` reads a Definition back without
     constructing anything, so you can retrieve any info you need
     from work already done.

6. **Producers self-provision.** This is axiom 2 seen from inside the
   loop: each producer's constructor creates everything it depends
   on — peer Definitions via `insert*` (create-or-reuse against the
   cache), library imports via `register`. `insert*` is `register`
   with more oomph: it computes the peer's settings, dedupes against
   the cache, wraps the value in a Definition, and stitches the
   cross-file import. By the time a producer is itself registered,
   its dependencies are already in place — registered ahead of it in
   its own file (they render above it), or in their own files with
   the import already wired.

7. **Therefore order cannot matter.** Whatever order generators run
   in, each one either creates or reuses its dependencies at the
   moment it needs them, so the output is always complete and
   identical. There is no plugin registry, no dependency graph, no
   topological sort — never propose "run gen-X first", priorities,
   or a pre-generation pass. The `generatorKey` recorded on each
   Definition (which generator + schema produced it) distinguishes
   safe reuse (same provenance) from a real naming collision
   (different provenance → `"Registered definition mismatch"`).

8. **Settings tell a Projection where it lands.** The Driver computes
   `ContentSettings` from the Projection's static methods: the
   identifier it will be assigned to (`toIdentifierName` /
   `toIdentifierType`), the file it will be written to
   (`toExportPath`), its parsed enrichments, and its variant. The
   instance reads them as `this.settings`. Snippets have no settings —
   they are anonymous fragments the parent embeds anywhere via
   `${...}`, which is exactly what makes them shareable and reusable.

9. **Consumers customize via enrichments; authors customize via
   source.** Each generator declares its own options as a Valibot
   schema in `enrichments.ts`; consumers supply values in
   `client.json`. Beyond that schema, generator source code is the
   customization surface: clone the generator and edit — stock
   generators' hardcoded paths and peer imports are *deliberate*
   customization seams, not missing config.

10. **The engine is language-blind; the import graph declares the
    language.** Core knows nothing about TypeScript. A generator
    declares its target language by importing its projection-base
    factory and snippet base from a language package (e.g. `toTsModelProjectionBase` /
    `TsSnippet` from `@skmtc/lang-typescript`), which owns the
    concrete `File` / `Import` / `Definition` subclasses, the
    identifier factories (`createVariable` / `createType`), and the
    syntax helpers. See §8 for emitting a language other than
    TypeScript.

Three engine-level facts that don't derive from the model but govern
authoring:

- **Generator code is valid synchronous Deno; the only side effects
  are logs and register/insert calls.** The Generate loop is
  synchronous — no `async` functions, `await`, Promises, or timers
  anywhere in generator source (emitted *text* may of course be
  async). No filesystem access (`Deno.env.get` is the one sanctioned
  environment read), no network (the Worker runs with `net: false`),
  no `process.*` node-isms. Output reaches the world only through
  `register` / `insert*`.

- **`OasSchema` is a union type, not a class hierarchy.**
  `OasObject`, `OasArray`, `OasString`, … are sibling classes, each
  implementing `.isRef()` returning `false`; `OasRef` is a *sibling*
  returning `true`. Never add a `BaseSchema` class — narrowing via
  `.isRef()` and the `.type` discriminator is the design.
- **The variant axis fans out at the engine, not the generator.** One
  source item can produce N Definitions via named variants declared in
  the consumer's enrichments (`[id][path][method]` for OAS,
  `[id][rootKind][fieldName]` for GQL, `[id][refName]` for models).
  `'main'` is always present — the engine throws at start if variants
  are declared without it. `variant` flows through
  `ContentSettings.variant`, the `GeneratorKey`'s trailing segment,
  and every static method and entry callback. See
  [`concepts/variants.md`](../../concepts/variants.md); enforcement
  tests in §12.

Deep dives: [`concepts/definitions-and-files.md`](../../concepts/definitions-and-files.md),
[`concepts/how-generators-produce-output.md`](../../concepts/how-generators-produce-output.md),
[`concepts/cross-generator-coordination.md`](../../concepts/cross-generator-coordination.md),
[`concepts/files-and-dedup.md`](../../concepts/files-and-dedup.md).

### Working method: scaffold first — do not audit the engine

The observed failure mode when authoring for a new language is
spending dozens of turns fetching and reading `@skmtc/core` source
(`deno doc` symbol by symbol, downloading files from jsr.io) to
become certain of every signature before writing anything. Don't.
The projection-base factory owns the engine contract — the core
surface a generator touches is small (the entry factory, `OasSchema`
narrowing, `insert*`/`register`), and every bit of it is already
demonstrated in the §6 scaffolds and inside the lang package's own
source.

The productive order:

1. **Know where the lang skill's generated API appendix is** — the
   `skmtc-lang-<X>` skill ships the package's full `deno doc` surface
   in its `appendix.md` (exact constructor and register shapes,
   generated from source). That is the "read the lang package" step
   with the reading already done: Read that file when a signature is
   in doubt; open the package source only for a symbol the appendix
   genuinely lacks. Don't pre-read it wholesale — the prose recipes
   carry the shapes you need for the common cases.
2. **Scaffold immediately** — run `skmtc create`, or copy the entry +
   enrichments scaffolds (§6) plus your lang skill's wiring scaffolds,
   then register the generator in the project
   `deno.json`, and run `skmtc bundle` within your first few
   actions.
3. **Let the toolchain teach** — bundle/typecheck errors name the
   exact signature you got wrong, one at a time. They are a faster
   and more reliable teacher than engine source: the factory's
   generics check your config either way, so pre-reading core buys
   certainty you get for free at bundle time. Two mechanics:
   `skmtc bundle`/`generate` run esbuild, which does NOT typecheck —
   a green generate can ride a type-broken generator, so run
   `deno check` explicitly before calling the work done. And run it
   from **inside** the project dir, in a subshell:
   `(cd .skmtc/<project> && deno check <gen>/mod.ts)` — from anywhere
   else the workspace import map doesn't apply and the one real error
   drowns under ~40 cascading resolution errors. The parentheses are
   load-bearing: an agent Bash tool's cwd DOES persist across calls
   (whatever the tool description claims), so a bare `cd` here leaves
   your next `skmtc generate` running from inside `.skmtc/` with
   misleading "missing schema" / empty-project errors; the subshell
   makes the leak impossible.

If you genuinely need one core signature, check this skill's
generated API appendix (`appendix.md` — the OAS IR + router
contracts) and the lang skill's `appendix.md` first, then how the
lang package uses it — core source is the last resort, not the
first. Auditing the engine to de-risk the first line
is unbounded in cost and the risk it retires is already retired by
the type checker.


## 2. Producers: Projection vs Snippet

Both descend from `SnippetBase` (`core/dsl/SnippetBase.ts`). The
differentiator: **does it have a name at file scope?**

| | Projection | Snippet |
|---|---|---|
| Base class | Built by the lang package's projection-base veneers (`toTsModelProjectionBase`, `toTsOasOperationProjectionBase`, `toTsGqlOperationProjectionBase`) | `TsSnippet` (the lang snippet base) when it registers; `SnippetBase` directly for pure value fragments |
| Static methods required | `id`, `toIdentifierName`, `toIdentifierType`, `toExportPath`, `toEnrichmentSchema` (`toEnrichments` is derived by the factory) | None |
| Instance has | `settings: ContentSettings` (identifier + exportPath + enrichments + variant) | `context`, optional `generatorKey` / `stackTrail` (attribution), `register()` (from `TsSnippet`) |
| Wrapped in `Definition` | Yes (by Driver) | No |
| Cached by | `(identifier.name, exportPath)` | Not cached |
| File-level export | Yes (`export const X = ...`) | No (embedded via `${...}`) |
| Reachable by other generators | Yes (via `insertOperation(MyProjection, op)`) | No |
| Examples in stock | `ShadcnForm`, `TanstackQuery`, `ZodProjection`, `TsProjection` | `FormFields`, `StringInput`, `SelectInput`, `CustomValue`, `Identifier` |

`Definition` extends `SnippetBase` — it's the wrapper that makes a
Projection's value exportable. Drivers create `Definition`s
automatically.

### When to write which

- **The per-item main artifact is always a Projection** (or, for an
  accumulator generator, contributions into a shared aggregate). A
  generator built entirely of Snippets that hand-registers its
  Definitions has bypassed the Driver path — no cache identity, no
  `ContentSettings`, unreachable by peers. Every generator has at
  least one top-level Projection unless it is accumulator-style.
- **Other generators may reach for it by name** → Projection
- **Needs file-scope export** → Projection
- **Fragment embedded in someone else's output (JSX child, function
  body, expression)** → Snippet
- **Unsure about a fragment** → Probably Snippet. Promote to
  Projection only when cross-file identity is needed. (This rule is
  about the *internals* of an artifact — it never overrides the first
  rule about the artifact itself.)

### The constructor / `toString()` contract

For both Projections and Snippets:

- **The constructor runs at most once per cache key** — on the
  Driver's cache miss for `(identifier.name, exportPath)`. Side
  effects (`this.register(...)`, `this.insertOperation(...)`) belong
  here.
- **`toString()` may run multiple times** — during Render, previews,
  integrity checks. It must be a **pure function of `this`**: no
  mutation, no side effects, no `register` calls (by Render time the
  file's imports are finalised), and **no construction** — the render
  tree (delegate snippets, parameter lists, any `new X(…)`) is built
  in the constructor; `toString()` only reads and interpolates, and
  refusals throw from the constructor (fail at generate, never at
  render). Cache anything expensive on `this` from the constructor.
  This split IS axiom 2's settlement guarantee seen from inside a
  producer: declaration happens at construction, render reads settled
  state.
- **Constructor and `toString` are the only methods — private
  helpers and get/set accessors included.** A producer with
  additional methods is being used as a service object or a
  string-builder — decompose that logic into delegate Snippets
  composed via `${...}` instead (orchestrator–delegate card,
  [`task-cards.md`](task-cards.md)).
  `private` does not exempt a method: a `private toAnnotations()` /
  `private assignMembership()` on a producer is the same violation,
  and the mechanical fix is a **module-level free function** taking
  `{ context, … }` that routes and constructs Snippet leaves (never
  assembles their text) — write it that way first rather than
  refactoring to it. A JS getter is still a method: a
  mirror like `get annotations() { return this.value.annotations }`
  is the anti-pattern form, as is copying into a new container
  (`this.annotations = [...this.value.annotations]`). A field other
  code reads off a producer (e.g. a lang value protocol read off the
  definition's value) is declared directly on that producer — and
  when the fact is computed by a router case on the routed value, the
  sanctioned wiring is reference-sharing in the constructor
  (`this.annotations = this.value.annotations` — one array, two
  names; push into it afterward, never reassign either name). The one legitimate
  exception: a mutator like `add()` on an accumulator's container
  value (`gen-msw`'s `MockRoutesList`).

### The type vocabulary

- **`Stringable`** — anything with a `.toString()`. The composition
  contract: a field typed `Stringable` accepts strings, Snippets,
  Definitions, `Identifier`s, and inserted handles interchangeably;
  template-literal interpolation calls `toString()` automatically.
- **`ContentSettings<E>`** — the `(identifier, exportPath,
  enrichments, variant)` bundle from §1 point 8; available as
  `this.settings`.

### The silhouette of a finished generator

Measured across the clean stock generators, a well-shaped generator
looks like this — use it as a self-check target, not a quota:

- **1 top-level Projection** (a variants- or multi-artifact generator
  may have a few) plus a fleet of **small Snippets** — most under
  50–100 lines each; a producer past ~150 lines is usually absorbing
  branches that belong in delegate Snippets.
- **Every class is a producer**; helper *functions* route and
  construct Snippets, they don't build strings. There is exactly ONE
  schema-dispatch site — the `SchemaToValueFn` router (axiom 1); a
  `schema.type` conditional anywhere else is a special case and the
  defining smell of a generator leaving the framework.
- **Producers have no methods beyond constructor and `toString`.**
- **String composition lives inside `toString()`** — in clean
  generators only a small minority of template text sits outside it
  (naming statics and small constructor-computed labels); when helper
  modules dominate the composition, snippets have been reduced to
  pass-throughs.
- **Zero** ad-hoc `{ toString: … }` objects, imports inside template
  literals, TODO stubs in emitted text; `as` casts at most rare,
  justified edge cases.

## 3. Writing producers into Files: register and insert

This section is axiom 2's machinery: how declaring a dependency at
construction time delivers the four guarantees (existence,
uniqueness, placement, settlement). The flow when
`MyProjection.constructor` calls
`this.insertOperation(OtherProjection, operation)`:

1. The projection-base wrapper auto-fills `destinationPath` from
   `this.settings.exportPath` and delegates to
   `context.insertOperation`, which constructs a Driver
   (`OasOperationDriver` / `GqlOperationDriver` / `ModelDriver`).
2. The Driver computes the peer's `settings` via
   `OtherProjection.toIdentifierName` / `toIdentifierType` /
   `toExportPath` — pure functions of `(operation, enrichments,
   variant)`, so same inputs always give the same cache key.
3. Cache lookup on `(identifier.name, exportPath)`:
   - **Hit + `affirmDefinition` passes** → returns the cached
     `Definition`.
   - **Hit + `generatorKey` mismatch** → throws `"Registered
     definition mismatch"`.
   - **Miss** → `new OtherProjection(...)` runs (recursively
     self-provisioning), and the result is wrapped in a `Definition`
     and registered.
4. If `exportPath !== destinationPath`, the Driver registers an
   import in the calling file pointing at the peer's output.

**You compose by calling, not by importing source.** Peers are
referenced by their Projection class —
`this.insertOperation(Other, op).toName()` returns the identifier
name to splice into your template. You never read another
generator's `toString()`.

### Which helper for which job?

`register` is the raw write; the `insert*` helpers add dedup,
Definition wrapping, and import stitching. Defaulting to `register`
for peer output bypasses all three.

| Situation | Use |
|---|---|
| Bring in a peer's output for a named ref in `components.schemas` | `context.insertModel(PeerProjection, ref)` |
| Bring in a peer's output for a schema that may be inline or a ref | `this.insertNormalizedModel(PeerProjection, { schema, fallbackName })` (auto-fills `destinationPath`) |
| Trigger another *operation* generator (a query hook, a select component) | `this.insertOperation(PeerProjection, op)` — or `context.insertOperation({ projection, operation, destinationPath })` from a Snippet or transform |
| Look up a Definition without triggering construction | `context.findDefinition({ name, exportPath })` |
| Add a sibling Definition in a file you already own (a type alias, a constant) | `defineAndRegister(context, { identifier, value, destinationPath })` — the **function** imported from `@skmtc/lang-typescript`; works from transforms and constructors alike (`this.defineAndRegister` does not type-check on factory-built projections — lang-base members are type-erased) |
| Register a library import (npm package, hand-written helper) from a **Projection** | `this.register({ imports: { 'pkg': ['Symbol'] } })` — own-file only; always lands in `this.settings.exportPath` (the args take no `destinationPath`) |
| Write imports/definitions into a file the Projection does **not** own | `this.registerInto(destinationPath, { imports })` — the explicit cross-file path. There is deliberately no `destinationPath ?? exportPath` fallback: own-file and cross-file are separate, loud paths |
| Register a library import from a **Snippet** | `this.register({ imports: { 'pkg': ['Symbol'] }, destinationPath })` — the parent passes `destinationPath` through the constructor; registers are **keyless** (`generatorKey` is optional attribution input only) |
| Register an import for a peer-generator output | **Don't** — `insertOperation` / `insertNormalizedModel` already did this for you |

### Variant threading

`insert*` defaults to `variant: 'main'` — the variant every peer
honours. Pass a non-`'main'` variant only when the peer declares it
AND you want its per-variant Definition; an undeclared variant throws
at the Driver (`assertPeerVariantExists`). Two variants of the same
Projection calling `this.insertOperation(VariantsUnawarePeer, op)`
(no variant arg) share the peer's `'main'` Definition — the standard
pattern when composing with variants-unaware peers like
`gen-typescript` / `gen-zod`. Full treatment: §10 "Authoring a
variants-aware generator".

### `insert*` enforces the peer's `isSupported`

Cross-generator `insertOperation` / `insertModel` deliberately
**bypasses the peer's `skip` / `include`** config (dependency edges
are filter-blind) but **does** enforce the peer's static
`isSupported`: an unsupported item throws at the Driver
(`assertPeerSupported`), the calling generator's item is recorded as
`error`, and the run continues — loud, isolated failure beats a
silently-broken Definition. The static probed is the one on the
peer's **projection base**; a peer without one supports everything.
Tests: `OasOperationDriver.test.ts` / `ModelDriver.test.ts` → "Peer
support validation".

### The operation-reference protocol

`this.insertOperation(KnownPeer, op)` covers *statically-known*
peers. The **operation-reference protocol** handles the harder case:
your output for one operation depends on *some other operation* whose
identity the consumer names as a string in their enrichment —
canonical case: `gen-shadcn-form` rendering a select field backed by
a list endpoint the consumer points at (by tag, fieldName, or path).

Shape (OAS, by tag — `gen-shadcn-form/src/schemaToField.ts:164`):

```ts
const getReferencedOperation = ({ context, references }) => {
  // 1. Look up the operation by name (here: a tag).
  const operation = context.document.value.operations.find(op =>
    op.tags?.includes(references) &&
    // 2. Verify a producer generator claims it.
    ShadcnSelectInput.isSupported({ context, operation: op })
  )
  invariant(operation, `Operation '${references}' not found`)
  return operation
}

// 3. Insert — Driver dedupes the Definition AND registers the import.
const def = context.insertOperation({
  projection: ShadcnSelectInput,
  operation: referencedOp,
  destinationPath: settings.exportPath
})
// 4. Reference by name in the rendered markup.
return `<${def.identifier.name} lens={lens.focus('${path}').defined()} />`
```

The four meeting points: the **operation reference** (a string in the
*consumer's own* enrichment schema), the producer's **`isSupported`**
(capability claim), the producer's static **`toIdentifierName` /
`toExportPath`** (cache identity), and **`insertOperation`**
(Definition + import). The consumer imports the producer's Projection
as a package dependency — no runtime config sharing, no
cross-namespace enrichment peeking. Operation references identify
operations, not variants — the peer's `'main'` variant is inserted
unless you pass `{ variant }` explicitly.

Detail and a GraphQL example:
[`concepts/cross-generator-coordination.md`](../../concepts/cross-generator-coordination.md).

## 4. Operational rules

Every distinct authoring rule, grouped by theme, each stated once.
When a proposed solution matches a ❌ here, the ✅ is almost always
the correct alternative. The full default-intuition → stance table is
mirrored in [`llms.md`](../../llms.md); design rationale in
[`explanation/design-philosophy.md`](../../explanation/design-philosophy.md).
TypeScript-output-specific rules (type-only imports / TS1484,
`sanitizePropertyName`) live in the `skmtc-lang-typescript` skill.

### Producing output

- **`transform` returns `void`.** Anything you `return` is discarded —
  the manifest shows `'success'` with no artifact. Produce output via
  `insert*` / `register` only. (There is no `acc` accumulator — it
  was removed; see the accumulator card in §10 for cross-item state.)
- **Never write files directly.** `Deno.writeFileSync` from a
  constructor puts a file on disk but not in `context.#files` —
  invisible to `findDefinition`, the artifacts payload, the manifest,
  and cleanup.
- **The engine injects the generated-file suffix into `toExportPath`.**
  The path a Projection declares gets the project's suffix
  (`client.json#settings.generatedSuffix`, default `'.generated'`)
  inserted before the extension — return `@/models/User.ts` and the
  file lands as `User.generated.ts`. Injection is idempotent (a path
  already carrying the suffix is unchanged), and explicit
  `destinationPath` arguments to `register`/`registerInto` are taken
  verbatim (never suffixed). Set
  `client.json#settings.generatedSuffix: ""` only when something
  genuinely keys on the exact filename — a TS module the app imports
  by name, a build script. Replacing a hand-written file does NOT by
  itself require it in package-resolved languages (Kotlin/JVM): the
  suffixed file provides the same package members and the marker
  survives.
- **Imports never go in template literals.** They land in the file
  *body* (TypeScript rejects) and bypass `Set`-based dedup. Register
  them in the constructor:

  ```ts
  // Projection — own file (args take no destinationPath):
  this.register({ imports: { 'y': ['X'] } })
  // Projection — a file it does NOT own:
  this.registerInto(otherPath, { imports: { 'y': ['X'] } })
  // Snippet — parent passes destinationPath through the constructor:
  this.register({ imports: { 'y': ['X'] }, destinationPath })
  ```

- **`toString()` emits only the value.** The Driver wraps it as
  `export const ${name} = ${value};` at Render. Writing
  `export const` yourself produces `export const Foo = export const
  Foo = ...` — a syntax error.
- **`toString()` is pure** — no mutation of `this`, no side effects,
  no `register` calls, no `new` of anything (snippets, parameter
  lists, Errors — the render tree is built in the constructor;
  refusals throw there too). It may run multiple times (Render,
  previews, integrity checks). The tostring-purity check flags every
  construction site.
- **No defensive `if (!already-registered)` around `register`.**
  Registration is already idempotent via Set / Map semantics.
- **Build strings by interpolating `Stringable`s** (`${snippet}`),
  never by concatenation — interpolation preserves Snippet recursion.
- **What the composition metric counts.** The structural eval measures
  where composition sits: template literals, `+` concatenation, and
  `.join()` are composition; **plain string literals are free
  everywhere**, and naming statics are bucketed separately. The
  warning fires when ≥50% of composition characters sit outside
  `toString()`. On a warning, the flagged check's rule prints with the
  eval's table and `--md <file>` lists the offending sites — no need
  to read anything else. The fix is placement, not hoisting: move
  dynamic composition into a snippet's `toString()`; a static string
  stays a literal at its use site (a constants module buys nothing —
  literals are uncounted there too).
- **No ad-hoc `{ toString: () => '…' }` objects.** The duck-type
  satisfies `Stringable` while lying about capabilities — no
  `context` (can never register an import), invisible to
  attribution. Extend `SnippetBase` (or `TsSnippet` when it
  registers).
- **Templates are template literals inside TypeScript classes**, not
  `.hbs` / `.mustache` files — type safety on interpolated values.
- **No placeholder / TODO content in `.generated.*` files — refuse
  the stub-scaffold pattern even when asked.** Generated files are
  overwritten every run; consumer edits filling a blank are silently
  wiped. Either emit complete working output, or don't emit that
  piece at all — point an import at a consumer-owned module instead:

  ```ts
  // ✅ the consumer-code seam: hand-written module, generated import
  this.register({ imports: { '@/handlers/on-submit': ['onSubmit'] } })
  ```

### Naming and caching

- **Derive identifier names from method + path (operations) or
  `refName` (models) inside `toIdentifierName`.** Never hardcode a
  name (breaks `(name, exportPath)` cache-key uniqueness); never
  derive from `operation.operationId` (author-controlled,
  emitter-dependent — fine for JSDoc, not a name source).
- **Role-suffix names; `.generated.*`-suffix files.** A bare noun
  (`customers`) is a plausible collision with a peer generator; a
  role suffix (`CreateCustomersForm`) makes it project-unique. The
  `.generated.tsx` filename suffix marks the file engine-owned and
  greppable.
- **`toIdentifierName`, `toIdentifierType`, `toExportPath` are pure
  functions** of their inputs — no `this`-state, no async, no
  environmental reads. The cross-generator cache depends on it.
- **Identifiers come from `createVariable(name)` /
  `createType(name)`** (lang package), not raw strings — the `kind`
  drives declaration keywords and import forms in the language layer.
- **Variants-aware generators fold `variant` into the name** —
  typically `withVariant(base, variant)` — and produce distinct
  export paths per variant. Otherwise variant 2 hits variant 1's
  cached Definition and the `generatorKey` integrity check fires
  `"Registered definition mismatch"`. Test:
  `OasOperationDriver.test.ts` → "forgets to vary toIdentifier
  collides on second variant".

### Composition

- **Reference peers via `insert*`, never via their statics.**
  `Peer.toIdentifierName(...)` skips Definition registration and
  import wiring and fails silently when its preconditions break;
  `insertOperation(Peer, op).toName()` is also a greppable
  dependency marker.
- **Never read another producer's rendered `toString()`.**
  Coordination is by identifier name only.
- **Never peek at another generator's enrichments**
  (`context.settings.enrichments['@other/gen-x']`). Add an
  operation-reference field to your *own* enrichment schema and
  `insertOperation` the peer (§3).
- **Don't auto-inherit `this.settings.variant` to a peer.** Peers are
  variants-unaware by default; the Driver throws on an undeclared
  variant. Let the `'main'` default apply; pass
  `{ variant: this.settings.variant }` only when the peer declares
  that variant and you want its per-variant Definition.
- **Projections take fixed constructor args** —
  `{ context, operation | refName, settings }` from the Driver, never
  custom args. Re-resolve dependencies inside the constructor; the
  memoization cache makes re-resolution free.
- **A shared file-scope export peers might reference by name is a
  Projection**, not a `defineAndRegister`-of-a-Snippet — a Definition
  built that way is unreachable through `insert*` (no Projection
  class to pass), so every consumer must hardcode the name string.
  `defineAndRegister` remains right for *private* siblings in a file
  you own and for the accumulator pattern ([`task-cards.md`](task-cards.md)).
- **`Inserted` exposes methods, not properties:** `.toName()`,
  `.toIdentifier()`, `.settings`, `.definition`. There is no
  `.identifier` property (TS2551) — prefer `.toName()` for the name.
- **Schema→type mapping is a Snippet tree, not a string helper.** The
  most tempting helper in a model generator —
  `toKotlinType(schema): string` / `toTsType(schema): string`
  returning `'List<String>'` — is string composition outside
  `toString()`. Model the target-language type as a value Snippet
  (schema in the constructor, rendering in `toString()`, item types
  interpolated recursively); helper functions may *route to* and
  *construct* these Snippets, never assemble their text. This keeps
  nested types recursive, lets leaf types self-register their
  imports, and is what the structural eval's string-composition
  check measures.

### Schema handling

- **`OasSchema` stays a union of siblings.** No `BaseSchema`, no
  runtime polymorphism — `.isRef()` + `.type` discriminator narrowing
  is the design.
- **Resolve before you reach — and resolve unconditionally.**
  `OasRef`-typed values (`OasSchema | OasRef<'schema'>` is the common
  parameter type) need `.resolve()` before property access, and every
  concrete schema variant implements `.resolve()` as `return this` —
  so a guard is redundant:

  ```ts fragment
  // ❌ WRONG — guarding a call that is identity on concrete schemas
  const resolved = schema.isRef() ? schema.resolve() : schema
  // ✅ RIGHT
  const resolved = schema.resolve()
  ```

  `.isRef()` is for **genuine branching only** — when the two branches
  do different things, not the same thing. The canonical case:
  `toRefName()` is a **method** on `OasRef`, callable only inside an
  `.isRef()` branch — reading `.refName` as a property returns
  `undefined` and crashes downstream. If you're calling `toRefName()`
  to build an import path by hand, switch to `insertNormalizedModel` —
  it handles named refs and inline schemas uniformly.
- **Object property values are a 3-way union.** `OasObject.properties`
  is `Record<string, OasSchema | OasRef<'schema'> | CustomValue>` —
  type schema-walking helpers against all three. `CustomValue`
  satisfies the same narrowing surface (`.isRef()` returns false,
  `.type === 'custom'`, `.resolve()` is identity), so it flows through
  a schema→type Snippet as the `default` branch.
- **Wire facts live on the concrete variant, never the union type.**
  `readOnly` / `writeOnly` / `format` / `enums` / `default` /
  `deprecated` are declared per-variant; `OasSchema` itself carries
  nothing, so flat property access off it does not compile — narrow
  first (`const resolved = schema.resolve()`, then
  `switch (resolved.type)`) and read the fact inside the branch. The
  crib sheet below covers the fields generators actually read; no
  source dive needed for these.

  Every variant has `title?` / `description?` / `example?` /
  `nullable?`, and all except `union` and `unknown` add `readOnly?` /
  `writeOnly?` / `deprecated?` / `default?` / `enums?` (plural — there
  is no `enum` field). Per-variant, beyond those:

  | `.type` | Variant-specific fields |
  |---|---|
  | `'string'` | `format?: string` (open — `date-time`, `uuid`, `decimal`, …), `pattern?`, `maxLength?` / `minLength?` |
  | `'integer'` | `format?: 'int32' \| 'int64'`, `minimum?` / `maximum?` / `exclusiveMinimum?` / `exclusiveMaximum?` / `multipleOf?` |
  | `'number'` | `format?: 'float' \| 'double'`, same bounds as `'integer'` |
  | `'boolean'` | nothing further |
  | `'array'` | `items: OasSchema \| OasRef<'schema'>`, `maxItems?` / `minItems?`, `uniqueItems?` — and its default is named `defaultValue`, not `default` |
  | `'object'` | `properties?` (the 3-way union above), `required?: string[]` (property names — presence here is what "required" means), `additionalProperties?: boolean \| OasSchema \| OasRef<'schema'>`, `maxProperties?` / `minProperties?` |
  | `'union'` | `members: (OasSchema \| OasRef<'schema'>)[]`, `discriminator?: { propertyName: string; mapping?: Record<string, string> }` — **no wire facts**: a `oneOf` member's `readOnly` / `format` live on the member, so resolve each member and read there |
  | `'unknown'` | nothing further — the untyped-schema fallback |

  `enums` in particular is **not** a string fact — every variant in
  that list carries it over its own element type (number enums,
  boolean enums, …). A router case that ignores `enums` has made a
  policy decision by omission and dropped a schema constraint
  silently; decide it in the case that owns the type.

  **Copy `Nullable`-generic field types verbatim; never simplify
  them.** `enums`, `default`, and `example` are declared as
  conditionals over each class's `Nullable` parameter (`Nullable
  extends true ? (string | null)[] | undefined : string[] |
  undefined`). `Nullable` defaults to `boolean | undefined`, so the
  conditional distributes and never collapses — `.resolve()` does not
  pin it to `false`, and at the use site the type is the full union
  (`string[] | (string | null)[] | undefined`). Declaring the single
  arm you expect (`enums: string[] | undefined`) and assigning the
  schema's field straight into it fails `deno check` — and `skmtc
  bundle` will NOT catch it (esbuild does not typecheck). Filter at
  the point of use, not by narrowing the field. The rule is not
  limited to that trio: **`OasObject.properties` is the same
  conditional shape** (`Record<…> | null | undefined` at use sites —
  the appendix declaration below is the authority), so presence
  guards must clear the `null` arm too (truthiness, not
  `!== undefined`).

  The table is a map; the territory is one Read away: the **generated
  API appendix** (`appendix.md`, this skill's directory) carries the
  full `deno doc` output for every variant class, `OasRef`,
  `CustomValue`, and the discriminator — field-by-field, generated
  from source. Consult it before opening core source; it cannot drift
  from what the source says.
- **`allOf` is already merged** (`core/oas/_merge-all-of/` runs at
  Parse). Treat received schemas as flat objects.
- **Unwrap before you switch.** OpenAPI refs can't carry extensions,
  so SKMTC sometimes models `$ref + extension` as a one-member
  union — unwrap single-member unions and `.resolve()` before
  `switch (schema.type)`.
- **The router is the only dispatch site** (axiom 1). The generator's
  `SchemaToValueFn` (`toZodValue`, `toTsValue`, `toKtValue`) owns
  every `schema.type` decision; a projection makes ONE router call
  for its value, and a composite snippet routes its children back
  through the same function. A `schema.type` ternary in a projection
  constructor, a value class that switches on schema type while
  rendering, a "just this one case" handled inline — each is a third
  door, and the road to broken. If a type needs different handling,
  that is a new router case returning a new snippet.
- **Annotations and defaults are decided inside the per-type
  snippet.** The router's dispatch answers `schema.type` once; every
  type-dependent decision (which serialization annotation, what
  default value) is made inside the snippet that dispatch constructed
  and exposed as a field on it (`annotations`, `defaultValue`) that
  the consuming renderer reads without narrowing. Position facts
  (wire-name renames) stay with the renderer that owns them;
  cross-variant wire facts are read with the `in` operator
  (`'readOnly' in resolved ? resolved.readOnly : undefined`) — a fact
  read, not a dispatch; and if a decision doesn't apply to some type,
  the router case that owns that type stops requesting it — no
  internal `schema.type !== 'union'` guard. A helper that re-resolves
  a schema and asks `.type === 'string'` after the router already
  routed is asking the already-answered question a second time — the
  single-dispatch check flags it. Worked example: `skmtc-lang-kotlin`
  §4.
- **Forward the typed schema into per-type Snippets, not just
  `modifiers`.** A router (`toZodValue`, `toTsValue`) that drops the
  schema silently erases constraints — a `[true]` enum becomes
  `z.boolean()` instead of `z.literal(true)`. Audit question: *what
  schema fields beyond modifiers does the Snippet's `toString()`
  read?* If any, the schema must come through.

### Gates and customization

- **Clone to customize; never add config flags.** This includes
  binary feature toggles on entries (`emitDocument?: boolean` is two
  generators in one package). Two consumers wanting different values
  means two cloned generators, not one flag. Enrichments cover only
  what the generator's Valibot schema declares.
- **`isSupported` declares capability, not user intent.** Never gate
  it on enrichment presence — that forces a sentinel for "all
  defaults". User intent is filtered outside the generator via
  `client.json#settings.include` / `.skip`. Carve-out for
  non-defaultable generators (every artifact needs a consumer-supplied
  pointer): keep `isSupported` pure and short-circuit in `transform`
  (`if (!enrichments?.rowComponent) return`).
- **No `lang` config field exists anywhere** — not on entries, not on
  projection-base factories, not on snippets. The import graph
  declares the language (§1 point 10, §8). Likewise there is no
  `destinationPath ?? exportPath` fallback on `register` — own-file
  and cross-file are separate, loud paths.
- **Fail open on bad schema input.** Log `ParseIssue`s, let
  `removeErroredItems` prune dependents; one bad schema mustn't kill
  the run. The manifest is the canonical record.
- **No runtime client library; no cross-run caching.** Output is
  committed source code with zero SKMTC runtime; each generate runs
  from cold in a fresh Worker (which is also what makes module-scope
  state per-run-safe).

### Code style

- **No `as` casts in production code** — narrow via type guards or
  discriminant checks; `as` is reserved for tests.
- **`switch` + exhaustive `never` default over `if`/`else if` chains
  of length ≥ 3** — the compiler then catches missed branches:

  ```ts
  default: {
    const _exhaustive: never = schema
    throw new Error(`Unhandled: ${JSON.stringify(_exhaustive)}`)
  }
  ```

- **`Deno.env.get('X')`, never `process.env.X`** — the engine runs in
  Deno workers.
- **Structural typing over runtime checks** — no `@override`
  decorators, no runtime type assertions.

## 5. Decision trees

### Should I clone or install a generator?

```
Need to change identifier naming, export paths, peer deps, or output shape?
├── No  → install
└── Yes → clone, then edit src/base.ts or src/<Main>.ts
```

**Peer generators almost always = install.** Composing via
`insertOperation(PeerProjection, …)` references the peer by its
Projection's name — you don't edit its source. Install it, then
`import { TsProjection } from "@skmtc/gen-typescript"`. Cloning a
peer "to understand it" is wasted work — its public API is its
Projection, documented in `reference/stock-generators/<pkg>.md`.
Clone only the ONE generator whose seams you'll actually edit.

### Should this be a Projection or a Snippet?

```
Need its own name at file scope (export const X = ...)?
├── Yes → Projection (extends a lang projection base; has the static methods)
└── No  → Snippet   (extends TsSnippet — or SnippetBase if it never registers —
                     anonymous, embedded via ${this.x})
```

### Where should generated string content go?

```
Final output text?        → SnippetBase descendant's toString() (template literal)
Import (own file)?        → this.register({ imports: { module: [names] } })
Import (another file)?    → this.registerInto(destinationPath, { imports }) — or, from a
                            Snippet, this.register({ imports, destinationPath })
Identifier name?          → createVariable(name) / createType(name) (lang package)
File path?                → join('@', ...) from @std/path
TS fragment not in OAS?   → new CustomValue({ context, value: '...' })
```

### Why is my generator's output empty?

```
1. transform being called?              → Check the manifest
2. isSupported rejecting?               → Check the gate predicate
3. skip/include filters excluding?      → Check .settings/client.json
4. transform returning instead of registering?
                                        → Return value is discarded; must use insert*/register
5. Schema shape wrong for the gate?     → e.g., gen-shadcn-form needs request body type === 'object'
6. Engine threw "must include a 'main' variant"?
                                        → Consumer wrote variants without 'main';
                                          add `main: {}` or remove the variants
```

For deeper diagnosis, hand off to `skmtc-debug` (verify-first stance).

## 6. Code scaffolds

Concrete templates to adapt; modify at the marked extension points.

### A–B. `base.ts` and the main Projection — concrete scaffolds in your lang skill

The projection-base factory (`base.ts`) and the main Projection class
are LANGUAGE wiring: the concrete scaffolds live in the target
language's skill (`skmtc-lang-typescript` / `skmtc-lang-kotlin`, §1),
loaded alongside this one. What this skill owns is their contract:

- `base.ts` calls the lang package's projection-base factory with
  `id` (from deno.json), the four statics — `toIdentifierName` /
  `toIdentifierType` / `toExportPath`, pure functions of
  `(operation | refName, enrichments, variant)` — and
  `toEnrichmentSchema`. The lang import here IS the language
  declaration.
- The Projection extends that base, takes the fixed Driver args
  (`{ context, operation | refName, settings }` — never custom args),
  self-provisions every dependency in the constructor (`insert*` for
  peers, `register` for library imports), and renders ONLY the value
  in `toString()` — the Driver wraps it in the declaration at Render.
- Variants-aware generators fold `variant` into the name via
  `withVariant(base, variant)` (returns `base` unchanged for
  `'main'`; kebab-strict names) and produce distinct export paths per
  variant — see [`variants.md`](variants.md).
### C. `mod.ts` — entry point with capability gate

```ts
// gen-x/src/mod.ts
import {
  toOasOperationEntry,
  type IsSupportedOasOperationArgs
} from '@skmtc/core'
import type { EnrichmentSchema } from './enrichments.ts'
import { toEnrichmentSchema } from './enrichments.ts'
import { MyGen } from './MyGen.ts'
import denoJson from '../deno.json' with { type: 'json' }

// The entry is pure pipeline config — no `lang` field; the language
// comes from base.ts's lang-package import (lang skill, §1).
export const MyGenEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,

  // ⬇ Capability gate — do NOT gate on enrichment presence (filter
  //   intent via client.json include/skip). Called per variant;
  //   `variant` is informational here, not a gate. The args type also
  //   carries `context` — the destructure below isn't the full surface.
  isSupported({ operation, variant }: IsSupportedOasOperationArgs) {
    return ['post', 'put', 'patch'].includes(operation.method) &&
      operation.requestBody?.resolve()?.toSchema()?.resolve().type === 'object'
  },

  // ⬇ Called per (operation, variant); returns void. Thread `variant`
  //   into insertOperation so the Driver builds per-variant settings.
  transform({ context, operation, variant }) {
    context.insertOperation({ projection: MyGen, operation, variant })
  },

  // ⬇ Optional: makes the artifact visible in the Editor's preview UI.
  //   Thread `variant` into each static-method call.
  toPreviewModule: ({ context, operation, variant }) => ({
    name: MyGen.toIdentifierName({
      operation,
      enrichments: MyGen.toEnrichments({ operation, context, variant }),
      variant
    }),
    exportPath: MyGen.toExportPath({
      operation,
      enrichments: MyGen.toEnrichments({ operation, context, variant }),
      variant
    }),
    group: 'forms'
  }),

  toEnrichmentSchema
})

export default MyGenEntry
```

### Scaffold C variant: GraphQL entry

GraphQL generators use `toGqlOperationEntry` — same entry shape, four
GQL-specific differences (enrichments not pre-resolved; mutation args
via `synthesizeArgsObject`; `rootKind`/`fieldName` routing; the GQL
projection-base factory). The scaffold and the differences live in
the `skmtc-graphql` skill — load it when the schema is GraphQL SDL.
### Scaffold C variant: Model entry (`toModelEntry`)

```ts fragment
import { toModelEntry } from '@skmtc/core'

export const MyModelEntry = toModelEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  // ⬇ Optional capability gate (default: every model). The predicate
  //   gets `refName` (no schema) — resolve it yourself when needed.
  isSupported({ context, refName }) {
    // Unconditional `.resolve()` — identity on concrete schemas;
    // never `schema.isRef() ? schema.resolve() : schema`.
    const schema = context.resolveSchemaRefOnce(refName, MyGen.id).resolve()
    return !schema.isRef() && schema.type === 'object'
  },

  transform({ context, refName, variant }) {
    context.insertModel(MyGen, refName, { variant })
  },

  toPreviewModule: ({ context, refName, variant }) => ({
    name: MyGen.toIdentifierName({
      refName,
      enrichments: MyGen.toEnrichments({ refName, context, variant }),
      variant
    }),
    exportPath: MyGen.toExportPath({
      refName,
      enrichments: MyGen.toEnrichments({ refName, context, variant }),
      variant
    }),
    group: 'models'
  })
})

export default MyModelEntry
```

Model-specific notes: `transform` receives `refName`, not a schema —
resolve via `context.resolveSchemaRefOnce(refName, baseId)`; the
Driver passes the schema to your Projection via `schemaToValueFn`.
Composition uses `context.insertModel`, not `insertOperation`.

### Entry-factory routing cheat sheet

| | `toOasOperationEntry` | `toModelEntry` |
|---|---|---|
| `transform` arg | `operation: OasOperation` | `refName: RefName` |
| `transform` return | `void` | `void` |
| `isSupported` | optional, default `() => true` | optional, default `() => true` (gets `refName`, no schema) |
| Enrichment routing | `enrichments.<id>.<path>.<method>.<variant>` | `enrichments.<id>.<refName>.<variant>` |
| Compose with | `this.insertOperation(P, op, { variant? })` | `this.insertModel(P, refName, { variant? })` |
| Companion base factory | `to<Lang>OasOperationProjectionBase` | `to<Lang>ModelProjectionBase` |
| `GeneratorKey` shape | `id\|path\|method\|variant` | `id\|refName\|variant` |

GraphQL (`toGqlOperationEntry`, routing
`<rootKind>.<fieldName>.<variant>`): load the `skmtc-graphql` skill.

Full reference: [`reference/api/entry-factories.md`](../../reference/api/entry-factories.md).
### D. `enrichments.ts` — Valibot schema for user overrides

`toEnrichmentSchema` returns the **composite umbrella**
`v.object({ subject, generator, stack })` — the three enrichment
scopes, each a generator-owned leaf at a different key-depth in
`client.json#settings.enrichments`. Declare only the scopes you read;
leave the rest `v.undefined()`. The umbrella is what
`this.settings.enrichments` carries.

```ts
// gen-x/src/enrichments.ts
import * as v from 'valibot'

// ⬇ Customize: the per-ITEM leaf — resolved per (operation/refName,
//   variant) at `[id][subject][variant]`.
const subjectEnrichmentSchema = v.optional(
  v.object({
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    fields: v.optional(
      v.array(v.object({ id: v.string(), label: v.optional(v.string()) }))
    )
  })
)

// ⬇ `subject` is per-item; `generator` is a run-constant for this one
//   generator (`[id]._generator`); `stack` is a run-constant shared
//   across every generator (`._stack`).
export const myGenEnrichmentSchema = v.object({
  subject: subjectEnrichmentSchema,
  generator: v.undefined(),
  stack: v.undefined()
})

export type EnrichmentSchema = v.InferOutput<typeof myGenEnrichmentSchema>
export const toEnrichmentSchema = () => myGenEnrichmentSchema
```

Key facts:

- `toEnrichmentSchema` is **required on both** the entry factory AND
  the projection-base config — required-ness is what lets
  `static toEnrichments` parse the raw umbrella cast-free. No
  enrichments at all → `toEnrichmentSchema: () => emptyEnrichmentSchema`
  (from `@skmtc/core`), as `gen-typescript` does — but keep the
  **file**: `src/enrichments.ts` exists in every finished generator,
  even when it only re-exports `emptyEnrichmentSchema`. It is the
  canonical seam consumers (and the structural eval) look for; an
  enrichment-free generator states that fact there rather than by
  the file's absence.
- Read the per-item leaf via `this.settings.enrichments.subject`. The
  run-constant scopes are read on demand from any context holder via
  `toGeneratorEnrichment(context, id, schema)` /
  `toStackEnrichment(context, schema)` (both `@skmtc/core`) — they
  are not threaded through per-item `ContentSettings`.
- `_stack` and `_generator` are engine-reserved keys; customer keys
  must not start with `_`.
- This file is canonical for what a consumer may pass under
  `client.json#settings.enrichments[generatorId][...routingKeys]`
  (routing keys per the cheat sheet above; see
  [enrichments-shape](../../reference/settings/enrichments-shape.md)).

### E. Snippet — the concrete scaffold is in your lang skill

The registering-snippet scaffold is language wiring — see the lang
skill's §1 (`TsSnippet` / `KtSnippet`). The contract stays here: a
snippet takes `context` plus an explicit `destinationPath` through
its constructor (it has no settings of its own — the parent passes
its `exportPath` down), registers keylessly, and `generatorKey` /
`stackTrail` are optional attribution inputs only.
### F. Module layout — where the files go

The scaffolds above are per-file; this is the whole-package shape.
There is one canonical layout, and it falls straight out of axiom 1:
one dispatch site, one snippet per schema variant, so **one module per
snippet, named after what it renders**.

```text
gen-x/
  deno.json
  mod.ts                    ← re-exports src/mod.ts (the package entry)
  src/
    mod.ts                  ← the entry factory + transform (scaffold C)
    base.ts                 ← the projection base; the lang import lives HERE (lang skill §1)
    enrichments.ts          ← always present, even when empty (scaffold D)
    <Name>Projection.ts     ← the top-level Projection (lang skill §1)
    Kt.ts / Ts.ts           ← the SchemaToValueFn router — the ONLY dispatch site
    StringValue.ts          ← one module per router case…
    IntegerValue.ts
    ObjectValue.ts
    RefValue.ts
    …
    protocol.ts             ← the generator's own value-field type, if it has one
```

Two facts that are otherwise derived rather than looked up:

- **The router and its value modules import each other circularly, and
  that is correct.** `Kt.ts` imports `ObjectValue.ts` to construct it;
  `ObjectValue.ts` imports `toKtValue` from `Kt.ts` to route its
  children. ESM handles this because every cross-reference happens
  *inside a constructor body*, never at module top level — which is
  the same constructor/`toString()` discipline §2 already requires, so
  a producer that obeys §2 cannot construct a cycle that breaks.
  Recursive composite types (an array of objects of arrays) need this
  cycle; do not try to break it with a registry, a late-bound setter,
  or by inlining cases back into the router.
- **A value module's file name is the name of what it renders, not the
  schema type it came from.** `EnumClassValue.ts`, not
  `StringWithEnums.ts` — the router case knows which schema type it
  dispatched; the module says what comes out.

For a package with many variants, `src/values/` as a subdirectory is
fine — the layout above is about *one module per producer*, not about
depth. What is not fine is a single `values.ts` holding every snippet:
it reintroduces the god-module the one-dispatch-site rule exists to
prevent, and it makes the producer-size check meaningless.

## 7. Customization seams in stock generators

Stock generators mark their customization points with deliberately
hardcoded values; to change one, clone and edit. The per-generator
seam tables and cloning gotchas (path-param runtime coupling,
monorepo output paths) live with the cloning card in
[`task-cards.md`](task-cards.md). Enrichments cover only what each
generator's Valibot schema declares; anything else requires cloning —
never suggest "configuring" a hardcoded value.

Semantic type mappings key on the schema's **`format`**, not on
property names. `format` is an open vocabulary, and a string schema
carrying `format: decimal` is the established way to mark an
exact-decimal money value — a Kotlin generator maps it to
`BigDecimal`. What the format *triggers* — which serde classes pair
with it, which annotations render — is generator policy in a named
seam; the trigger itself belongs in the schema. If a schema carries
no marker, add one (it is a one-line, semantically inert edit) rather
than hardcoding property-name lists into the generator.

## 8. Emitting a language other than TypeScript

Everything in this skill except the concrete wiring scaffolds is
language-agnostic — the model (§1), the DSL (§2), coordination (§3),
and the rules (§4) all transliterate; generator source is always
TypeScript, only the *emitted* code changes language. The language
enters through the lang package imports (the projection-base veneer
and snippet base), which own the concrete `File` / `Import` /
`Definition` subclasses, the identifier factories,
`defineAndRegister`, syntax helpers, and identifier sanitization.
Entries stay in `@skmtc/core` — pure pipeline config, no language.
Load the target language's `skmtc-lang-<x>` skill alongside this one
for the wiring scaffolds and the emitted-code rules; Kotlin also has
a scaffolder (`skmtc create … model --lang kotlin`). Keep the target
language's conventions in the naming seams (`toIdentifierName`
casing, `toExportPath` layout) and everything else — purity,
self-provisioning, compose-don't-concatenate — exactly as here.
## 9. Verification checklist

After writing or editing a generator, verify:

**Model conformance**

- [ ] `transform` produces output only via `insert*` / `register` —
  returns nothing meaningful
- [ ] At least one top-level Projection exists (or the generator is
  genuinely accumulator-style: `findDefinition` + `defineAndRegister`
  around a shared aggregate)
- [ ] No ordering or multi-pass assumptions — dependencies are
  created-or-reused via `insert*` at construction time
- [ ] Generator source is synchronous Deno: no `async`/`await`/
  Promises/timers, no fs APIs (`Deno.env.get` is the one sanctioned
  read), no network, no `process.*`
- [ ] Constructor side effects are safe to repeat (the system
  memoizes; idempotency is required); `toString()` is pure AND
  construction-free (no `new` — the render tree is built in the
  constructor)
- [ ] Producers carry no methods beyond `constructor` and `toString`
  (accumulator container mutators excepted); no ad-hoc
  `{ toString: … }` object literals anywhere
- [ ] Exactly ONE schema-dispatch site: every `schema.type`
  conditional lives in the `SchemaToValueFn` router; projections make
  a single router call for their value; composite snippets route
  children back through the same function (axiom 1 — no third door)
- [ ] Annotation / default-value decisions live inside the per-type
  snippets, exposed as value fields the renderer reads — nothing
  re-asks `.type`; wire facts read via `in`; applicability decided by
  which router case requests the decision
- [ ] No producer sorts definitions, forward-declares, hand-wires an
  import for an inserted peer, or checks whether a dependency
  "already exists" — declaration at construction is the whole job
  (axiom 2)

**Naming and caching**

- [ ] `toIdentifierName` / `toIdentifierType` / `toExportPath` are pure
  functions of `(operation | refName, enrichments, variant)`
- [ ] Names derived from method+path / refName (never hardcoded, never
  `operationId`), role-suffixed; export paths `.generated.*`-suffixed
- [ ] Identifiers built with `createVariable` / `createType`, not raw
  strings

**Registration and composition**

- [ ] All imports via `this.register({ imports })` (own file) /
  `this.registerInto(path, { imports })` (cross-file) /
  `this.register({ imports, destinationPath })` (Snippet) — none in
  template literals
- [ ] Registering snippets extend the lang snippet base and receive an
  explicit `destinationPath`; sibling definitions use the
  `defineAndRegister` **function** from the lang package (not
  `this.defineAndRegister`)
- [ ] Peer references via `insertOperation(Other, op).toName()` — never
  peer statics, never `.toString()`, never
  `context.settings.enrichments['@other/gen-id']`
- [ ] The projection-base factory and snippet base are imported from
  the target language's `lang-*` package; entries carry no `lang`

**Schema handling**

- [ ] `OasSchema | OasRef<'schema'>` narrowed with `.isRef()` before
  `.type` / `.properties`; `.toRefName()` only inside an `.isRef()`
  branch (and only if `insertNormalizedModel` won't do the job)
- [ ] `switch (schema.type)` preceded by single-member-union unwrap and
  ref resolve; no new `BaseSchema`-style base classes
- [ ] `grep -n 'isRef() ?' src/` returns nothing — the ternary guard
  around `.resolve()` is redundant (identity on concrete schemas);
  `.isRef()` is for genuine branching only
- [ ] Per-type Snippet routers forward the typed schema, not just
  modifiers

**Enrichments and gates**

- [ ] Enrichment shape declared via Valibot umbrella
  (`v.object({ subject, generator, stack })`, unused scopes
  `v.undefined()`, or `emptyEnrichmentSchema`) and wired on BOTH the
  entry factory and the projection-base config
- [ ] Per-item enrichment read via `this.settings.enrichments.subject`;
  run-constant scopes via `toGeneratorEnrichment` /
  `toStackEnrichment` — never by indexing reserved `_`-keys
- [ ] `isSupported` is a capability predicate — no enrichment-presence
  gating (that's `client.json` `include`/`skip`)

**Variants**

- [ ] Every variant-carrying static and entry callback destructures
  `variant`; `transform` threads it into `insert*`;
  `toPreviewModule` / `toMappingModule` thread it into static calls
  (`toIdentifierType` takes no `variant`)
- [ ] Variants-aware: `toIdentifierName` folds `variant` in (via
  `withVariant`); export paths distinct per variant
- [ ] Cross-gen `insert*` does NOT auto-inherit
  `this.settings.variant` — `'main'` default unless the peer declares
  the variant

**Style** — no `as` casts outside tests; `switch` + `never` over long
`if`/`else` chains. TypeScript-output checks (type-only imports /
TS1484, `sanitizePropertyName`): `skmtc-lang-typescript` skill.

Where an enforcement test exists for an invariant (§12), check it
passes before declaring the work done.

## 10. Task cards

The step-by-step cards live in [`task-cards.md`](task-cards.md) —
open it when starting a multi-step job for the first time:

| Card | Trigger |
|---|---|
| Cloning and customizing a stock generator | change naming/paths/output of an installed generator (includes the per-generator seam tables) |
| Authoring a new generator from scratch | `skmtc create` |
| Recreating a hand-written file | replacing one existing file with generated output |
| Adding a field type to a form generator | new schema shape needs a new input |
| Swapping a peer dependency | different HTTP/validation layer |
| Adding enrichment options | new consumer-facing options |
| One Projection, several output shapes | orchestrator–delegate pattern |
| Emitting a barrel | re-export-only file |
| Accumulator-style generator | one shared aggregate, many contributors |

Variants-aware authoring: [`variants.md`](variants.md) — read it
whenever the consumer's `client.json` declares variants beyond
`main`.
## 11. Boundary with other skills

- **skmtc-lang-typescript**: the TypeScript target-language layer —
  the shape of *emitted* TS (type-only imports, syntax helpers,
  sanitization). Load alongside this skill for any TS-emitting
  generator; template for future `skmtc-lang-<X>` skills.
- **skmtc-cli**: install / clone / bundle / dev commands. This skill
  picks up once you're editing generator source.
- **skmtc-debug**: when output is broken. Verify-first stance takes
  priority — switch rather than proposing fixes from training-data
  defaults.
- **skmtc-retro**: end-of-session reflection; captures gaps in this
  skill's coverage.

When unsure: *what to write* → this skill; *why it's broken* →
`skmtc-debug`.

## 12. Cross-references

Concept deep-dives, the full API-reference link set, and the
enforcement-test index live in [`references.md`](references.md). The
rule to remember: where an enforcement test exists for an invariant,
the test is the executable spec — read or run it when in doubt.
## Appendix — generated API reference

The full `deno doc` surface for the packages this skill covers lives
in [`appendix.md`](appendix.md), in this skill's directory —
generated from framework source at `278f1ea2`, signatures and
field docs only. It is **authoritative**: when the prose above does
not carry the exact constructor or field shape you need, Read (or
grep) `appendix.md` instead of diving into package source. Do not
guess signatures. For a symbol not listed there,
`deno doc <file> <Symbol>` against the framework source beats
grepping it.

<!-- api-appendix:end -->
