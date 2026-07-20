---
name: skmtc-generator
version: 0.7.0
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

## 1. The generation model

SKMTC generation, start to finish:

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
   **producer** — a *Projection* or a *Snippet* — normally by calling
   `context.insertOperation` / `insertModel` from `transform`. The
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

6. **Producers self-provision.** Each producer's constructor creates
   everything it depends on — peer Definitions via `insert*`
   (create-or-reuse against the cache), library imports via
   `register`. `insert*` is `register` with more oomph: it computes
   the peer's settings, dedupes against the cache, wraps the value in
   a Definition, and stitches the cross-file import. By the time a
   producer is itself registered, its dependencies are already in
   place — in the right files, with the right imports.

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
  file's imports are finalised). Cache anything expensive on `this`
  from the constructor.
- **Constructor and `toString` are the only methods — private
  helpers and get/set accessors included.** A producer with
  additional methods is being used as a service object or a
  string-builder — decompose that logic into delegate Snippets
  composed via `${...}` instead (orchestrator–delegate card, §10).
  `private` does not exempt a method: a `private toAnnotations()` /
  `private assignMembership()` on a producer is the same violation,
  and the mechanical fix is a **module-level free function** taking
  `{ context, … }` that routes and constructs Snippet leaves (never
  assembles their text) — write it that way first rather than
  refactoring to it. A JS getter is still a method: a
  mirror like `get annotations() { return this.value.annotations }`
  is the anti-pattern form — and so is copying the field
  (`this.annotations = this.value.annotations`). A field other code
  reads off a producer (e.g. a lang value protocol read off the
  definition's value) is declared directly on that producer, not
  buried one level deep and mirrored out. The one legitimate
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
  construct Snippets, they don't build strings.
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

The flow when `MyProjection.constructor` calls
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
  verbatim (never suffixed). When the consumer requires an exact
  filename — recreating a hand-written file, a module the app imports
  by name — set `client.json#settings.generatedSuffix: ""` rather
  than fighting the suffix inside `toExportPath`.
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
  no `register` calls. It may run multiple times (Render, previews,
  integrity checks).
- **No defensive `if (!already-registered)` around `register`.**
  Registration is already idempotent via Set / Map semantics.
- **Build strings by interpolating `Stringable`s** (`${snippet}`),
  never by concatenation — interpolation preserves Snippet recursion.
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
  you own and for the accumulator pattern (§10).
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

  The table is a map; the territory is ALSO in this skill: the
  **generated API appendix** at the end carries the full `deno doc`
  output for every variant class, `OasRef`, `CustomValue`, and the
  discriminator — field-by-field, generated from source. Consult it
  before opening core source; it cannot drift from what the source
  says.
- **`allOf` is already merged** (`core/oas/_merge-all-of/` runs at
  Parse). Treat received schemas as flat objects.
- **Unwrap before you switch.** OpenAPI refs can't carry extensions,
  so SKMTC sometimes models `$ref + extension` as a one-member
  union — unwrap single-member unions and `.resolve()` before
  `switch (schema.type)`.
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

### A. `base.ts` — Projection base factory

```ts
// gen-x/src/base.ts
import {
  capitalize,
  camelCase,
  toMethodVerb,
  withVariant  // only needed for variants-aware generators
} from '@skmtc/core'
// ⬇ The factory comes from the LANG package — this import is what
//   declares the generator's target language.
import { toTsOasOperationProjectionBase } from '@skmtc/lang-typescript'
import { join } from '@std/path'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const MyGenBase = toTsOasOperationProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,

  // ⬇ Customize: how is the identifier NAME derived? Returns a plain
  //   string — the cache-key half; must stay pure and side-effect-free.
  //   `variant` is always present ('main' minimum). Variants-unaware:
  //   ignore it. Variants-aware: wrap in withVariant(base, variant).
  toIdentifierName({ operation, variant }): string {
    const verb = capitalize(toMethodVerb(operation.method))
    const base = `${verb}${camelCase(operation.path, { upperFirst: true })}`
    // Variants-unaware:    return base
    return withVariant(base, variant)
  },

  // ⬇ Customize: the non-name identifier parts. The `kind` drives
  //   declaration keywords and import forms in the language layer —
  //   'variable' for `export const`, 'type' for `export type`.
  toIdentifierType: () => ({ type: 'variable' }),

  // ⬇ Customize: where does the generated file land?
  toExportPath({ operation, enrichments, variant }): string {
    const name = this.toIdentifierName({ operation, enrichments, variant })
    return join('@', 'my-gen', `${name}.generated.ts`)
  }
})
```

`withVariant(base, 'main')` returns `base` unchanged; other variants
append a PascalCased suffix (`withVariant('Form', 'line-items')` →
`'FormLineItems'`). Variant names are kebab-strict
(`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`).

### B. `<MainProjection>.ts` — operation Projection class

```ts
// gen-x/src/MyGen.ts
import { TsProjection } from '@skmtc/gen-typescript'
import { MyGenBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'
import type { OasOperationProjectionConstructorArgs } from '@skmtc/core'
import invariant from 'tiny-invariant'

export class MyGen extends MyGenBase {
  tsRequestBodyName: string

  constructor({
    context,
    operation,
    settings
  }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    // ⬇ toRequestBody returns undefined when the operation has no body —
    //   narrow before handing it on (isSupported gates on it, so throw).
    const requestBody = operation.toRequestBody(({ schema }) => schema)
    invariant(requestBody, 'Request body is required')

    // ⬇ Self-provision: compose with peers by name. The Driver handles
    //   ref resolution, dedup, and import registration.
    const tsRequestBody = this.insertNormalizedModel(TsProjection, {
      schema: requestBody,
      fallbackName: `${settings.identifier.name}Body`
    })
    this.tsRequestBodyName = tsRequestBody.identifier.name

    // ⬇ Register runtime imports needed by toString().
    this.register({
      imports: { 'some-runtime-library': ['someHelper'] }
    })
  }

  override toString(): string {
    // ⬇ Pure function of `this`; emit ONLY the value — the Driver
    //   wraps it as `export const ${name} = ${value};` at Render.
    return `someHelper<${this.tsRequestBodyName}>(...)`
  }
}
```

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
// comes from base.ts's lang-package import (scaffold A).
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

### Scaffold C variant: GraphQL entry (`toGqlOperationEntry`)

```ts fragment
import { toGqlOperationEntry, synthesizeArgsObject } from '@skmtc/core'

export const MyGqlEntry = toGqlOperationEntry<EnrichmentSchema>({
  id: denoJson.name,

  // ⬇ Mutations only, gated on a synthesizable args object.
  isSupported({ operation }) {
    return operation.rootKind === 'mutation' &&
      synthesizeArgsObject(operation) !== undefined
  },

  transform({ context, operation, variant }) {
    if (operation.rootKind !== 'mutation') return
    context.insertOperation({ projection: MyGen, operation, variant })
  },

  toEnrichmentSchema
})
```

GQL-specific notes:

1. **Enrichments are *not* pre-resolved for GQL.** OAS pre-resolves by
   path+method; GQL hands you the raw operation — reach the subject
   leaf at `context.settings.enrichments[id][operation.identifier][variant]`
   yourself (`operation.identifier` is `<rootKind>_<fieldName>`).
2. **Mutation args come via `synthesizeArgsObject(operation)`** — GQL
   has no `requestBody`; this turns the field's arguments into an
   object schema for `insertNormalizedModel`.

Background: [`concepts/the-graphql-pipeline.md`](../../concepts/the-graphql-pipeline.md).

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

| | `toOasOperationEntry` | `toGqlOperationEntry` | `toModelEntry` |
|---|---|---|---|
| `transform` arg | `operation: OasOperation` | `operation: GqlOperation` | `refName: RefName` |
| `transform` return | `void` | `void` | `void` |
| `isSupported` | optional, default `() => true` | optional, default `() => true` | optional, default `() => true` (gets `refName`, no schema) |
| Enrichment routing | `enrichments.<id>.<path>.<method>.<variant>` | `enrichments.<id>.<rootKind>.<fieldName>.<variant>` | `enrichments.<id>.<refName>.<variant>` |
| Compose with | `this.insertOperation(P, op, { variant? })` | `this.insertOperation(P, op, { variant? })` | `this.insertModel(P, refName, { variant? })` |
| Companion base factory | `toTsOasOperationProjectionBase` | `toTsGqlOperationProjectionBase` | `toTsModelProjectionBase` |
| `GeneratorKey` shape | `id\|path\|method\|variant` | `id\|rootKind\|fieldName\|variant` | `id\|refName\|variant` |

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

### E. Snippet — anonymous embedded fragment

```ts
// gen-x/src/MyFieldSnippet.ts
import type { GenerateContextType, OasRef, OasSchema } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'

type MyFieldSnippetArgs = {
  context: GenerateContextType
  name: string
  label?: string
  destinationPath: string    // ⬅ Snippets have no exportPath; the parent passes it
  schema?: OasSchema | OasRef<'schema'> // ⬅ optional: originating node, for attribution
}

export class MyFieldSnippet extends TsSnippet {
  name: string
  label: string | undefined

  constructor({ context, name, label, destinationPath, schema }: MyFieldSnippetArgs) {
    // ⬇ stackTrail is an optional attribution input — clone at the
    //   call site (the live trail is mutable).
    super({ context, stackTrail: schema?.stackTrail.clone() })
    this.name = name
    this.label = label

    // ⬇ Self-provision against the parent's destinationPath — keyless.
    this.register({
      imports: { '@/components/fields/my-field': ['MyField'] },
      destinationPath
    })
  }

  override toString() {
    return `<MyField name="${this.name}"${this.label ? ` label="${this.label}"` : ''} />`
  }
}
```

The parent constructs it with
`new MyFieldSnippet({ …, destinationPath: this.settings.exportPath })`
and interpolates it with `${this.fieldSnippet}`. `generatorKey` is an
*optional* attribution (gen-maps) input — thread
`generatorKey: this.generatorKey` into `super(...)` to attribute the
snippet to the parent generator; registering never needs it.

## 7. Customization seams in stock generators

Deliberately hardcoded values marking customization points. To change
them: clone and edit.

| Seam | Location | Customize by |
|---|---|---|
| Export path | `gen-x/src/base.ts` → `toExportPath` | Edit the `join('@', ...)` call — keep the `.generated.*` suffix |
| Identifier naming | `gen-x/src/base.ts` → `toIdentifierName` | Edit the name-building expression — keep a role suffix |
| Peer dependency (e.g., HTTP layer) | `gen-x/src/<Main>.ts` top imports | Swap the import target |
| Consumer-side component path | `gen-x/src/fields/<X>.ts` `register` call | Change the import key |
| Capability gate | `gen-x/src/mod.ts` → `isSupported` | Change the predicate |
| Enrichment schema | `gen-x/src/enrichments.ts` | Add Valibot fields |
| Field-type routing (form generators) | `gen-x/src/schemaToField.ts` | Add a branch (specific above general) |

Enrichments are limited to what each generator's Valibot schema
declares; anything else requires cloning — never suggest "configuring"
a hardcoded value.

Semantic type mappings key on the schema's **`format`**, not on
property names. `format` is an open vocabulary, and a string schema
carrying `format: decimal` is the established way to mark an
exact-decimal money value — a Kotlin generator maps it to
`BigDecimal`. What the format *triggers* — which serde classes pair
with it, which annotations render — is generator policy in a named
seam; the trigger itself belongs in the schema. If a schema carries
no marker, add one (it is a one-line, semantically inert edit) rather
than hardcoding property-name lists into the generator.

> **Runtime coupling — path-param naming.** Generators that read URL
> params (e.g. `gen-shadcn-form`'s `useSafeParams`) hard-code the
> **OpenAPI** path-param name into the generated component. If the
> consumer's router names the param differently (`{id}` vs
> `:invoiceId`), the form throws at mount — confirm the names line up
> (`rg ':<param>' src/router*`) before migrating such output.

> **Targeting another package (monorepo output).** `toExportPath`
> returns a **forward path** under the target package's `rootPath` —
> e.g. `join('packages/models/src', \`${name}.generated.ts\`)` —
> never a `../`-relative path (rejected at config load). The consumer
> declares the package in `client.json#settings.packages`; imports
> then render `@/…` intra-package and `moduleName` cross-package. See
> [`reference/settings/client-json-schema.md`](../../reference/settings/client-json-schema.md).

## 8. Emitting a language other than TypeScript

Everything in this skill except the lang-package imports is
language-agnostic — the model (§1), the DSL (§2), coordination (§3),
the rules (§4), and the scaffold *shapes* (§6) all transliterate. A
server-code or DTO generator for Kotlin, C#, or any other language is
the same three files (`base.ts`, `<Main>.ts`, `mod.ts`) with the lang
imports swapped; the generator source itself is always TypeScript —
only the *emitted* code changes language.

What a language package owns (and what you therefore import from it
instead of `@skmtc/lang-typescript`):

- The projection-base veneers (`to<X>ModelProjectionBase`,
  `to<X>OasOperationProjectionBase`, `to<X>GqlOperationProjectionBase`)
  and the snippet base (`<X>Snippet`) — extending these is what
  declares the target language; Drivers read it off the class's
  inherited static.
- The concrete `File` / `Import` / `Definition` subclasses — how an
  imports header, a declaration (`export const` vs `val` vs
  `public static`), and a re-export render in that language.
- The identifier factories (`createVariable` / `createType`
  equivalents) — the identifier `kind` drives declaration keywords
  and import forms.
- The `defineAndRegister` function, syntax helpers, and identifier
  sanitization for that language's rules.
- Entries stay in `@skmtc/core` — `toOasOperationEntry` /
  `toGqlOperationEntry` / `toModelEntry` are pure pipeline config
  with no language involvement.

Kotlin has a full language skill (`skmtc-lang-kotlin`) and a
scaffolder (`skmtc create … model --lang kotlin` — a working baseline
to customise); other non-TypeScript layers are pre-alpha — read the
lang package's source for exact export names, with
`skmtc-lang-typescript` as the template for what a language layer
covers. Keep the target language's conventions in
the *naming seams* (`toIdentifierName` should produce idiomatic
casing for the target language; `toExportPath` its file layout), and
keep everything else — purity, self-provisioning, compose-don't-
concatenate — exactly as for TypeScript.

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

1. **Read the lang skill's generated API appendix** — the
   `skmtc-lang-<X>` skill carries the package's full `deno doc`
   surface (exact constructor and register shapes, generated from
   source). That is the "read the lang package" step with the reading
   already done; open the package source only for a symbol the
   appendix genuinely lacks.
2. **Scaffold immediately** — transliterate §6's A–C with the lang
   imports swapped, register the generator in the project
   `deno.json`, and run `skmtc bundle` within your first few
   actions.
3. **Let the toolchain teach** — bundle/typecheck errors name the
   exact signature you got wrong, one at a time. They are a faster
   and more reliable teacher than engine source: the factory's
   generics check your config either way, so pre-reading core buys
   certainty you get for free at bundle time.

If you genuinely need one core signature, check this skill's
generated API appendix (the OAS IR) and the lang skill's appendix
first, then how the lang package uses it — core source is the last
resort, not the first. Auditing the engine to de-risk the first line
is unbounded in cost and the risk it retires is already retired by
the type checker.

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
  memoizes; idempotency is required); `toString()` is pure
- [ ] Producers carry no methods beyond `constructor` and `toString`
  (accumulator container mutators excepted); no ad-hoc
  `{ toString: … }` object literals anywhere

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

### Card: Cloning and customizing a stock generator

```bash
skmtc clone <project> -g @skmtc/gen-<name>     # see skmtc-cli skill
```

Then: inspect `ls .skmtc/<project>/gen-<name>/src/`, pick the seam
(§7), edit — `src/base.ts` for path/identifier changes,
`src/<Main>.ts` for output shape, `src/enrichments.ts` for new user
options. Iterate with `skmtc dev <project>` (rebundle + regenerate on
save); verify against §9.

### Card: Authoring a new generator from scratch

```bash
skmtc create <project> <gen-name> operation   # or 'model'
skmtc create <project> <gen-name> model --lang kotlin   # Kotlin target
```

`--lang kotlin` (model generators) writes a SKELETON — the mechanical
wiring (entry, projection base, one projection, a data-class
parameter-list snippet, `enrichments.ts`, the project `deno.json`
registration) plus an empty `toKtValue` router typed `SchemaToValueFn`
that throws on every schema type. It bundles and type-checks;
`generate` fails loudly, naming each unmapped type, until you
implement the schema→snippet mapping: one case per `schema.type`,
each returning a small self-rendering snippet that takes the typed
variant (the `toZodValue` / `Ts.ts` shape in the stock generators).
Declaration kinds beyond data-class/typealias, union handling, format
policy, and serialization annotations are all yours to author. In a
non-TTY session `create` runs headlessly from its command-line args.

For TypeScript, then, matching scaffolds A–D: implement `isSupported` in `src/mod.ts`;
`toIdentifierName` / `toIdentifierType` / `toExportPath` in
`src/base.ts` (the lang import here declares the target language);
the Projection in `src/<MainProjection>.ts`; decompose into Snippets
(scaffold E) as needed; always create `src/enrichments.ts` (scaffold
D — `emptyEnrichmentSchema` when there are no user options). Iterate
with `skmtc dev <project>`.

### Card: Recreating a hand-written file

When the target is an exact file the app compiles against (a
hand-written `Dtos.kt`, a module imported by name): a constant
`toExportPath` returning that one path; `client.json#settings.generatedSuffix: ""`
so the engine writes the exact filename; register every definition
into the one file (same-package peers need no import wiring); policy
seams for whatever the schema cannot express. The diff against the
hand-written original is the acceptance signal — KDoc prose and
declaration ordering are non-derivable and remain.

### Card: Adding a new field type to a form generator

Prerequisite: cloned. Create `src/fields/MyInput.ts` mirroring
`StringInput.ts` (scaffold E); add a branch in
`src/schemaToField.ts` returning it for the relevant schema shape
(specific branches above general); implement the consumer-side
component at the path the Snippet registers.

### Card: Swapping a peer dependency (e.g., HTTP layer)

Prerequisite: consuming generator cloned; replacement peer installed.
Edit the peer import at the top of `src/<MainProjection>.ts` (e.g.
`gen-tanstack-query-supabase-zod` → `gen-tanstack-query-fetch-zod`).
Peer packages exporting same-shaped Projections need no other change.

### Card: Adding enrichment options to a generator

Prerequisite: cloned. Add Valibot fields in `src/enrichments.ts`
(scaffold D); consume via `this.settings.enrichments.subject` in the
constructor; document the keys in
`reference/stock-generators/gen-<name>.md`. Consumers set them under
`client.json#settings.enrichments[gen-id]...`.

### Card: One Projection, several output shapes (orchestrator–delegate)

When output varies by schema or enrichment shape (query vs mutation
hook, create vs edit form), don't accumulate boolean flags and
`if`-cascades in `toString()`. Give the orchestrator ONE field typed
as a union of delegate Snippets, each with its own complete state:

```ts
export class TanstackQuery extends TanstackQueryBase {
  delegate: QueryHook | MutationHook   // each extends SnippetBase

  constructor(args: OasOperationProjectionConstructorArgs) {
    super(args)
    this.delegate = args.operation.method === 'get'
      ? new QueryHook({ /* its own complete state */ })
      : new MutationHook({ /* its own complete state */ })
  }

  override toString() {
    return `${this.delegate}`
  }
}
```

New output shapes become new delegate classes, not new flags. Worked
example: `gen-tanstack-query-supabase-zod/src/TanstackQuery.ts`.

### Card: Authoring a variants-aware generator

Use the variant axis when output naturally splits into N artifacts
per item — section-edit forms for a broad PATCH endpoint, wizard
steps, mock-scenario flavours. NOT for cross-cutting overrides like a
label or theme (those are enrichment fields): variants partition
output; enrichments parameterise it.

1. **`src/base.ts`** — `toIdentifierName` folds `variant` in via
   `withVariant(base, variant)`; `toExportPath` threads `variant`
   into its `toIdentifierName` call so each variant lands in its own
   file.
2. **`src/mod.ts`** — `transform` threads `variant` into
   `context.insertOperation({ projection, operation, variant })`;
   `toPreviewModule` / `toMappingModule` thread it into every static
   call.
3. **`src/enrichments.ts` — no change.** The variant axis is
   core-owned; your schema describes the *per-variant inner* shape.
   Consumers wrap it in the variant record (`{ main: {…},
   customer: {…} }`) in `client.json`.
4. **Internal siblings** (a Body type, a Props type) — derive
   `fallbackName` from `settings.identifier.name`; it's
   variant-bound already, so siblings pick up the suffix. Canonical:
   `gen-shadcn-form/src/ShadcnForm.ts`.
5. **Cross-package peers** — `this.insertOperation(Peer, op)` with no
   variant arg; both your variants share the peer's `'main'`
   Definition (§4 "Composition").
6. **Consumer migration** — wrap existing operation-level enrichment
   in `{ main: {…} }`; variants without `'main'` throw at start.

Worked example: `gen-shadcn-form` (post-0.5.0); enforcement tests in
§12.

### Card: Emitting a barrel (re-export-only file)

Re-exports flow through the register family as
`Record<string, Identifier[]>` keyed by source module path; each
identifier's kind picks `export { x }` vs `export type { x }`;
entries merge across registering generators.

```ts
// Own file:
this.register({ reExports: { './User.generated.ts': [identifier] } })
// Shared barrel — each contributor registers into it explicitly:
this.registerInto(join('@', 'index.generated.ts'), {
  reExports: { './User.generated.ts': [identifier] }
})
```

A barrel is *not* an accumulator (next card): no aggregate value, no
`defineAndRegister`.

### Card: Accumulator-style generator (one shared aggregate, many contributors)

When the output is a *single* aggregate value that grows as items are
visited (a routes table, a registry), the per-item Projection isn't
the artifact — it contributes into one. Canonical: `gen-msw`'s
`toRoutesList` (`gen-msw/src/mod.ts`):

```ts fragment
import { defineAndRegister } from '@skmtc/lang-typescript'

transform: ({ context, operation }) => {
  // 1. Insert the per-operation artifact normally.
  const insertedRoute = context.insertOperation({
    projection: MockRoute,
    operation
  })
  const { exportPath } = insertedRoute.settings
  const route = insertedRoute.toName()
  if (!route) return

  // 2. Look up the shared aggregate (read-without-register).
  const existing = context.findDefinition({
    name: 'toRoutesList',
    exportPath
  })

  if (existing?.value instanceof MockRoutesList) {
    existing.value.add(route)   // 3a. hit → mutate the existing value
    return
  }

  // 3b. miss → defineAndRegister a fresh aggregate, then add. The
  //     FUNCTION comes from the lang package — a transform is a
  //     closure with no class, so the language comes from the import.
  const routesList = defineAndRegister(context, {
    identifier: createVariable('toRoutesList'),
    value: new MockRoutesList({ context }),
    destinationPath: exportPath
  })
  routesList.value.add(route)
}
```

The aggregate is a `SnippetBase` whose `toString()` renders the full
accumulated value. `findDefinition` + `defineAndRegister` let many
contributors land in one Definition without the Driver path's
cache-key collision rules. Reference:
[`reference/stock-generators/gen-msw.md`](../../reference/stock-generators/gen-msw.md).

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

- Concept docs: [`concepts/definitions-and-files.md`](../../concepts/definitions-and-files.md), [`concepts/how-generators-produce-output.md`](../../concepts/how-generators-produce-output.md), [`concepts/projections-and-snippets.md`](../../concepts/projections-and-snippets.md), [`concepts/cross-generator-coordination.md`](../../concepts/cross-generator-coordination.md), [`concepts/files-and-dedup.md`](../../concepts/files-and-dedup.md), [`concepts/the-three-phases.md`](../../concepts/the-three-phases.md), [`concepts/variants.md`](../../concepts/variants.md), [`concepts/languages.md`](../../concepts/languages.md)
- API reference: [`reference/api/`](../../reference/api/) — full DSL surface
- Per-generator clone seams: [`reference/stock-generators/`](../../reference/stock-generators/)
- Tutorials / how-tos / recipes: [`authoring/tutorials/`](../../authoring/tutorials/), [`authoring/how-to/`](../../authoring/how-to/), [`authoring/recipes/`](../../authoring/recipes/)
- Design rationale: [`explanation/design-philosophy.md`](../../explanation/design-philosophy.md), [`explanation/why-clone-to-customize.md`](../../explanation/why-clone-to-customize.md)
- Consolidated LLM reference: [`llms.md`](../../llms.md) — the full operational-principles table is canonical there; §4 here is the authoring-weighted digest

### Tests that enforce the invariants

The rules above are prose; these tests are the executable specs —
when in doubt whether a rule still applies, read or run the test.

- Variant axis: `core/context/GenerateContext.variants.test.ts`,
  `core/context/GenerateContext.end-to-end.test.ts`,
  `core/helpers/toVariantList.test.ts`,
  `core/helpers/withVariant.test.ts`
- Variant threading on `insert*`:
  `core/context/GenerateContext.cross-variant.test.ts`
- Auto-inherit variant tripwire:
  `core/dsl/operation/oas/OasOperationDriver.test.ts` → "Variant validation"
- Variants-aware `toIdentifierName` ignoring `variant`:
  `core/dsl/operation/oas/OasOperationDriver.test.ts` → "forgets to vary toIdentifier collides on second variant"
- `GeneratorKey` serialize/parse contract:
  `core/dsl/GeneratorKeys.test.ts` → round-trip tests
- Variant-bound `fallbackName` composition (the `ShadcnForm` pattern):
  `core/context/GenerateContext.normalized-model-variants.test.ts`
- Bit-identical rendering across variant changes:
  `core/run/toArtifacts.regression.test.ts`

<!-- api-appendix:begin — GENERATED, do not edit by hand -->

## Appendix — generated API reference

> Generated from framework source at `eb16419c` by
> `deno run --allow-read --allow-write --allow-run=deno,git .scripts/generate-skill-api-appendix.ts`
> (from `deno/`). **Authoritative** for signatures, fields, and doc
> comments — trust it instead of re-reading package source. For a
> symbol not listed here, `deno doc <file> <Symbol>` against the
> framework source beats grepping it.

### `@skmtc/core` — the OAS IR a generator reads

The schema classes handed to `transform` / projections via `resolveSchemaRefOnce` and friends: every `OasSchema` variant with its exact fields, plus `OasRef`, `CustomValue`, and the discriminator. Wire facts (`readOnly` / `writeOnly` / `format` / `enums` / `default`) live on the concrete variants listed here — narrow with `switch (resolved.type)` and read inside the branch.

### `core/oas/schema/Schema.ts`

```text
Defined in deno/core/oas/schema/Schema.ts:110:1

type OasSchema = OasArray | OasBoolean | OasInteger | OasNumber | OasObject | OasString | OasUnknown | OasUnion
  Union type representing all possible OpenAPI Schema objects in the SKMTC system.

  `OasSchema` is the fundamental type for representing any OpenAPI schema definition
  after it has been parsed and processed by the SKMTC pipeline. It encompasses all
  JSON Schema types supported by OpenAPI 3.x specifications, providing type-safe
  access to schema properties and validation constraints.

  This union type is used throughout the system for schema processing, type generation,
  and validation. Each variant corresponds to a specific JSON Schema type with its
  own set of properties and validation rules.

  ## Supported Schema Types

  - {@link OasArray}: Array schemas with item type definitions and constraints
  - {@link OasBoolean}: Boolean schemas with optional default values
  - {@link OasInteger}: Integer schemas with numeric constraints and formats
  - {@link OasNumber}: Number schemas with numeric constraints and formats
  - {@link OasObject}: Object schemas with properties, required fields, and constraints
  - {@link OasString}: String schemas with length constraints, patterns, and formats
  - {@link OasUnknown}: Schemas with unknown or mixed types
  - {@link OasUnion}: Union schemas representing oneOf/anyOf/allOf constructs

  @example
      Type checking and processing

      ```typescript
      import type { OasSchema } from '@skmtc/core';

      function processSchema(schema: OasSchema): string {
        if (schema.type === 'object') {
          // TypeScript knows this is OasObject
          return `Object with ${Object.keys(schema.properties || {}).length} properties`;
        } else if (schema.type === 'array') {
          // TypeScript knows this is OasArray
          return `Array of ${schema.items.type} items`;
        } else if (schema.type === 'string') {
          // TypeScript knows this is OasString
          return `String${schema.format ? ` (${schema.format})` : ''}`;
        }
        // Handle other types...
        return `${schema.type} type`;
      }
      ```

  @example
      Schema validation and constraints

      ```typescript
      function validateSchemaConstraints(schema: OasSchema, value: unknown): boolean {
        switch (schema.type) {
          case 'string':
            if (typeof value !== 'string') return false;
            if (schema.minLength && value.length < schema.minLength) return false;
            if (schema.maxLength && value.length > schema.maxLength) return false;
            if (schema.pattern && !new RegExp(schema.pattern).test(value)) return false;
            return true;

          case 'integer':
          case 'number':
            if (typeof value !== 'number') return false;
            if (schema.minimum && value < schema.minimum) return false;
            if (schema.maximum && value > schema.maximum) return false;
            return true;

          case 'array':
            if (!Array.isArray(value)) return false;
            if (schema.minItems && value.length < schema.minItems) return false;
            if (schema.maxItems && value.length > schema.maxItems) return false;
            return true;

          default:
            return true;
        }
      }
      ```

  @example
      Code generation based on schema type

      ```typescript
      class TypeScriptGenerator {
        generateType(schema: OasSchema): string {
          switch (schema.type) {
            case 'object':
              return this.generateInterface(schema);
            case 'array':
              return `Array<${this.generateType(schema.items)}>`;
            case 'string':
              if (schema.enums) {
                return schema.enums.map(e => `'${e}'`).join(' | ');
              }
              return 'string';
            case 'integer':
            case 'number':
              return 'number';
            case 'boolean':
              return 'boolean';
            case 'union':
              return schema.variants.map(v => this.generateType(v)).join(' | ');
            default:
              return 'unknown';
          }
        }
      }
      ```


Defined in deno/core/oas/schema/Schema.ts:135:1

type ToJsonSchemaOptions = { resolve: boolean; }
  Configuration options for JSON Schema conversion operations.

  These options control how OAS schemas are converted back to JSON Schema format,
  particularly around reference resolution and schema inlining behavior.

  @example
      ```typescript
      const options: ToJsonSchemaOptions = {
        resolve: true  // Resolve $ref references during conversion
      };

      const jsonSchema = schema.toJsonSchema(options);
      ```
```
### `core/oas/string/String.ts`

```text
Defined in deno/core/oas/string/String.ts:44:1

class OasString<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: StringFields<Nullable>, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "string"
    Constant value 'string' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the string.
  description: string | undefined
    A description of the string.
  format: string | undefined
    The format of the string.
  enums: Nullable extends true ? (string | null)[] | undefined : string[] | undefined
    An array of allowed values for the string.
  maxLength: number | undefined
    The maximum length of the string.
  minLength: number | undefined
    The minimum length of the string.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? string | null | undefined : string | undefined
    An example of the string.
  pattern: string | undefined
    The pattern of the string.
  default: Nullable extends true ? string | null | undefined : string | undefined
    The default value of the string.
  readOnly: boolean | undefined
    Whether the string is read-only.
  writeOnly: boolean | undefined
    Whether the string is write-only.
  deprecated: boolean | undefined
    Whether the string is deprecated.
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasString<Nullable>
  resolveOnce(): OasString<Nullable>
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject

Defined in deno/core/oas/string/String.ts:13:1

type StringFields<Nullable extends boolean | undefined> = { title?: string; description?: string; format?: string; default?: Nullable extends true ? string | null | undefined : string | undefined; pattern?: string; enums?: Nullable extends true ? (string | null)[] | undefined : string[] | undefined; maxLength?: number; minLength?: number; nullable?: Nullable; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? string | null | undefined : string | undefined; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasString}.

  @template Nullable
      Whether the string value can be null
```
### `core/oas/integer/Integer.ts`

```text
Defined in deno/core/oas/integer/Integer.ts:47:1

class OasInteger<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: IntegerFields<Nullable>, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "integer"
    Constant value 'integer' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the integer.
  description: string | undefined
    A description of the integer.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  format: "int32" | "int64" | undefined
    The format of the integer.
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
    An array of allowed values for the integer.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? number | null | undefined : number | undefined
    An example of the integer.
  multipleOf: number | undefined
    The multiple of the integer.
  maximum: number | undefined
    The maximum value of the integer.
  exclusiveMaximum: boolean | undefined
    Whether the maximum value is exclusive.
  minimum: number | undefined
    The minimum value of the integer.
  exclusiveMinimum: boolean | undefined
    Whether the minimum value is exclusive.
  default: Nullable extends true ? number | null | undefined : number | undefined
    The default value of the integer.
  readOnly: boolean | undefined
    Whether the integer is read-only.
  writeOnly: boolean | undefined
    Whether the integer is write-only.
  deprecated: boolean | undefined
    Whether the integer is deprecated.
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasInteger<Nullable>
  resolveOnce(): OasInteger<Nullable>
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject

Defined in deno/core/oas/integer/Integer.ts:12:1

type IntegerFields<Nullable extends boolean | undefined> = { title?: string; description?: string; nullable?: Nullable; format?: "int32" | "int64"; default?: Nullable extends true ? number | null | undefined : number | undefined; enums?: Nullable extends true ? (number | null)[] | undefined : number[] | undefined; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? number | null | undefined : number | undefined; multipleOf?: number; maximum?: number; exclusiveMaximum?: boolean; minimum?: number; exclusiveMinimum?: boolean; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasInteger}.

  @template Nullable
      Whether the integer value can be null
```
### `core/oas/number/Number.ts`

```text
Defined in deno/core/oas/number/Number.ts:48:1

class OasNumber<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: NumberFields<Nullable>, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "number"
    Constant value 'number' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the number.
  default: Nullable extends true ? number | null | undefined : number | undefined
    The default value of the number.
  description: string | undefined
    A description of the number.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? number | null | undefined : number | undefined
    An example of the number.
  enums: Nullable extends true ? (number | null)[] | undefined : number[] | undefined
    An array of allowed values for the number.
  format: "float" | "double" | undefined
    The format of the number.
  multipleOf: number | undefined
    The multiple of the number.
  maximum: number | undefined
    The maximum value of the number.
  exclusiveMaximum: boolean | undefined
    Whether the maximum value is exclusive.
  minimum: number | undefined
    The minimum value of the number.
  exclusiveMinimum: boolean | undefined
    Whether the minimum value is exclusive.
  readOnly: boolean | undefined
    Whether the number is read-only.
  writeOnly: boolean | undefined
    Whether the number is write-only.
  deprecated: boolean | undefined
    Whether the number is deprecated.
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasNumber<Nullable>
  resolveOnce(): OasNumber<Nullable>
  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject

Defined in deno/core/oas/number/Number.ts:13:1

type NumberFields<Nullable extends boolean | undefined> = { title?: string; description?: string; nullable?: Nullable; default?: Nullable extends true ? number | null | undefined : number | undefined; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? number | null | undefined : number | undefined; enums?: Nullable extends true ? (number | null)[] | undefined : number[] | undefined; format?: "float" | "double"; multipleOf?: number; maximum?: number; exclusiveMaximum?: boolean; minimum?: number; exclusiveMinimum?: boolean; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasNumber}.

  @template Nullable
      Whether the number can be null (affects type unions)
```
### `core/oas/boolean/Boolean.ts`

```text
Defined in deno/core/oas/boolean/Boolean.ts:35:1

class OasBoolean<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: BooleanFields<Nullable>, context?: ParseContextType)
    Creates a new OasBoolean instance.

    @param fields
        Boolean configuration fields including validation constraints and metadata

    @param context
        Optional ParseContext. When passed and attribution is
        enabled, the current StackTrail is snapshotted onto the
        instance (via the {@link OasBase} base).

  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "boolean"
    Constant value 'boolean' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the boolean.
  description: string | undefined
    A description of the boolean.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? boolean | null | undefined : boolean | undefined
    An example of the boolean.
  enums: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined
    Possible values the boolean can have
  default: Nullable extends true ? boolean | null | undefined : boolean | undefined
    The default value of the boolean.
  readOnly: boolean | undefined
    Whether the boolean is read-only
  writeOnly: boolean | undefined
    Whether the boolean is write-only
  deprecated: boolean | undefined
    Whether the boolean is deprecated
  isRef(): this is OasRef<"schema">
    Determines if this boolean is a reference object.

    @return
        Always returns false since this is a concrete boolean instance, not a reference

  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasBoolean<Nullable>
    Resolves this boolean object.

    @return
        The boolean instance itself since it's already a concrete object, not a reference

  resolveOnce(): OasBoolean<Nullable>
    Resolves this boolean object one level.

    @return
        The boolean instance itself since it's already a concrete object, not a reference

  toJsonSchema(options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject
    Converts this OAS boolean to an OpenAPI v3 JSON schema representation.

    @param options
        Conversion options (currently unused for boolean schemas)

    @return
        OpenAPI v3 boolean schema object with type and all validation constraints


Defined in deno/core/oas/boolean/Boolean.ts:13:1

type BooleanFields<Nullable extends boolean | undefined> = { title?: string; description?: string; nullable?: Nullable; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? boolean | null | undefined : boolean | undefined; enums?: Nullable extends true ? (boolean | null)[] | undefined : boolean[] | undefined; default?: Nullable extends true ? boolean | null | undefined : boolean | undefined; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasBoolean}.

  @template Nullable
      Whether the boolean can be null (affects type unions)
```
### `core/oas/array/Array.ts`

```text
Defined in deno/core/oas/array/Array.ts:44:1

class OasArray<Nullable extends boolean | undefined = boolean | undefined> extends OasBase

  constructor(fields: ArrayFields<Nullable>, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "array"
    Constant value 'array' useful for type narrowing and tagged unions.
  items: OasSchema | OasRef<"schema">
    Defines the type of items in the array.
  title: string | undefined
    A short summary of the array.
  description: string | undefined
    A description of the array.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  uniqueItems: boolean | undefined
    Indicates whether the array items must be unique.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
    An example of the array.
  maxItems: number | undefined
    The maximum number of items in the array.
  minItems: number | undefined
    The minimum number of items in the array.
  enums: Nullable extends true ? (unknown | null)[] | undefined : unknown[] | undefined
    The enum values for the array.
  defaultValue: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined
    The default value for the array.
  readOnly: boolean | undefined
    Whether the array is read-only.
  writeOnly: boolean | undefined
    Whether the array is write-only.
  deprecated: boolean | undefined
    Whether the array is deprecated.
  isRef(): this is OasRef<"schema">
    Determines if this array is a reference object.

    @return
        Always returns false since this is a concrete array instance, not a reference

  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasArray<Nullable>
    Resolves this array object.

    @return
        The array instance itself since it's already a concrete object, not a reference

  resolveOnce(): OasArray<Nullable>
    Resolves this array object one level.

    @return
        The array instance itself since it's already a concrete object, not a reference

  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.ArraySchemaObject
    Converts this OAS array to an OpenAPI v3 JSON schema representation.

    @param options
        Conversion options including reference handling and formatting preferences

    @return
        OpenAPI v3 array schema object with type, items schema, and all validation constraints


Defined in deno/core/oas/array/Array.ts:13:1

type ArrayFields<Nullable extends boolean | undefined> = { items: OasSchema | OasRef<"schema">; title?: string; description?: string; nullable?: Nullable; uniqueItems?: boolean; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined; maxItems?: number; minItems?: number; enums?: Nullable extends true ? (unknown | null)[] | undefined : unknown[] | undefined; defaultValue?: Nullable extends true ? unknown[] | null | undefined : unknown[] | undefined; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasArray}.

  @template Nullable
      Whether the array value can be null
```
### `core/oas/object/Object.ts`

```text
Defined in deno/core/oas/object/Object.ts:153:1

class OasObject<Nullable extends boolean | undefined = boolean | undefined> extends OasBase
  Represents an object schema in the OpenAPI Specification.

  `OasObject` handles both:

  - Objects: Types with fixed, named properties (like TypeScript interfaces)
  - Records: Types with dynamic keys and consistent value types (like TypeScript Record<string, T>)

  This class provides comprehensive support for object validation constraints,
  property management, and JSON Schema conversion. It supports nullable types
  through generic type parameters and handles complex property relationships.

  ## Key Features

  - Property Management: Add/remove properties with automatic required field handling
  - Type Safety: Generic nullable type support with proper TypeScript inference
  - Validation: Min/max properties, additional properties, and enum constraints
  - JSON Schema: Convert to standard JSON Schema format for validation
  - Immutability: All mutations return new instances (functional style)

  @template Nullable
      Whether the object value itself can be null

  @example
      Basic object schema

      ```typescript
      import { OasObject } from '@skmtc/core';

      const userObject = new OasObject({
        title: 'User',
        description: 'A user in the system',
        properties: {
          id: new OasString({ title: 'User ID' }),
          name: new OasString({ title: 'Full Name' }),
          email: new OasString({ format: 'email' })
        },
        required: ['id', 'name'],
        additionalProperties: false
      });
      ```

  @example
      Dynamic property management

      ```typescript
      // Start with empty object
      let schema = OasObject.empty();

      // Add properties dynamically
      schema = schema.addProperty({
        name: 'id',
        schema: new OasString(),
        required: true
      });

      schema = schema.addProperty({
        name: 'metadata',
        schema: new OasObject({ additionalProperties: true }),
        required: false
      });

      // Remove a property
      schema = schema.removeProperty('metadata');
      ```

  @example
      Record-style object (additional properties)

      ```typescript
      const recordObject = new OasObject({
        title: 'StringMap',
        description: 'A map of string keys to string values',
        additionalProperties: new OasString(), // Any string key -> string value
        minProperties: 1 // At least one property required
      });

      // This allows: { [key: string]: string }
      ```

  @example
      Nullable object support

      ```typescript
      const nullableUser = new OasObject<true>({
        nullable: true,
        properties: {
          name: new OasString()
        },
        default: null // Can have null default when nullable
      });

      // This represents: { name: string } | null
      ```


  constructor(fields: OasObjectFields<Nullable>, context?: ParseContextType)
    Creates a new OasObject instance.

    @param fields
        Object configuration fields

    @example
        ```typescript
        const userSchema = new OasObject({
          title: 'User',
          properties: {
            id: new OasString({ title: 'ID' }),
            name: new OasString({ title: 'Name' })
          },
          required: ['id'],
          additionalProperties: false
        });
        ```

  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "object"
    Constant value 'object' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the object.
  description: string | undefined
    A description of the object.
  externalDocs: OasExternalDocs | undefined
    External documentation for the object.
  nullable: Nullable | undefined
    Indicates whether value can be null.
  properties: Nullable extends true ? Record<string, OasSchema | OasRef<"schema"> | CustomValue> | null | undefined : Record<string, OasSchema | OasRef<"schema"> | CustomValue> | undefined
    A record which maps property names of the object to their schemas.
  required: string[] | undefined
    An array of required property names.
  additionalProperties: boolean | OasSchema | OasRef<"schema"> | undefined
    Indicates whether additional properties are allowed.

    This is equivalent to a Record type in TypeScript.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: Nullable extends true ? Record<string, unknown> | null | undefined : Record<string, unknown> | undefined
    An example of the object.
  default: Nullable extends true ? Record<string, unknown> | null | undefined : Record<string, unknown> | undefined
    The default value of the object.
  maxProperties?: number
    Maximum number of properties allowed in the object
  minProperties?: number
    Minimum number of properties required in the object
  readOnly?: boolean
    Whether the object is read-only
  writeOnly?: boolean
    Whether the object is write-only
  deprecated?: boolean
    Whether the object schema is deprecated
  enums?: Nullable extends true ? (Record<string, unknown> | null)[] | undefined : Record<string, unknown>[] | undefined
    Array of valid enum values for the object
  static empty(): OasObject<false>
    Creates a new empty OasObject with no properties.

    This factory method creates a non-nullable object with empty properties
    and required arrays, useful as a starting point for dynamic object building.

    @return
        A new empty OasObject instance

    @example
        ```typescript
        // Start with empty object and build up
        let schema = OasObject.empty();

        schema = schema.addProperty({
          name: 'id',
          schema: new OasString(),
          required: true
        });

        schema = schema.addProperty({
          name: 'name',
          schema: new OasString(),
          required: true
        });
        ```

  addProperty({name, schema, required}: AddPropertyArgs): OasObject
    Adds a new property to the object.

    This method returns a new OasObject instance with the added property,
    following an immutable pattern. If the property is marked as required,
    it will be added to the required array.

    @param args
        Property addition arguments

    @param args.name
        The name of the property to add

    @param args.schema
        The schema definition for the property

    @param args.required
        Whether the property should be required (default: false)

    @return
        A new OasObject with the added property

    @example
        Adding a simple property

        ```typescript
        const original = OasObject.empty();
        const withName = original.addProperty({
          name: 'username',
          schema: new OasString({ minLength: 3 }),
          required: true
        });

        console.log(withName.required); // ['username']
        ```

    @example
        Chaining property additions

        ```typescript
        const userSchema = OasObject.empty()
          .addProperty({
            name: 'id',
            schema: new OasInteger(),
            required: true
          })
          .addProperty({
            name: 'email',
            schema: new OasString({ format: 'email' }),
            required: true
          })
          .addProperty({
            name: 'age',
            schema: new OasInteger({ minimum: 0 }),
            required: false
          });
        ```

  removeProperty(name: string): OasObject
    Removes a property from the object.

    This method returns a new OasObject instance with the specified property
    removed. If the property was required, it will also be removed from the
    required array. If the property doesn't exist, returns the same instance.

    @param name
        The name of the property to remove

    @return
        A new OasObject with the property removed, or the same instance if property doesn't exist

    @example
        ```typescript
        const userSchema = new OasObject({
          properties: {
            id: new OasString(),
            name: new OasString(),
            email: new OasString(),
            temporaryField: new OasString()
          },
          required: ['id', 'name', 'temporaryField']
        });

        // Remove temporary field
        const cleanedSchema = userSchema.removeProperty('temporaryField');

        console.log(cleanedSchema.required); // ['id', 'name']
        console.log('temporaryField' in cleanedSchema.properties); // false
        ```

  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasObject
  resolveOnce(): OasObject
  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject
    Converts the OasObject to a standard JSON Schema object.

    This method serializes the object to the JSON Schema format used in
    OpenAPI specifications. It handles property conversion, additional
    properties rules, and validation constraints.

    @param options
        Conversion options for handling references and context

    @return
        A JSON Schema representation of the object

    @example
        ```typescript
        const userObject = new OasObject({
          title: 'User',
          properties: {
            id: new OasString(),
            name: new OasString()
          },
          required: ['id'],
          additionalProperties: false
        });

        const jsonSchema = userObject.toJsonSchema({ refContext: new Map() });

        console.log(jsonSchema);
        // {
        //   type: 'object',
        //   title: 'User',
        //   properties: {
        //     id: { type: 'string' },
        //     name: { type: 'string' }
        //   },
        //   required: ['id'],
        //   additionalProperties: false
        // }
        ```


Defined in deno/core/oas/object/Object.ts:59:1

type AddPropertyArgs = { name: string; schema: OasSchema | OasRef<"schema"> | CustomValue | undefined; required?: boolean; }
  Arguments for the {@link OasObject.addProperty} method.

Defined in deno/core/oas/object/Object.ts:15:1

type OasObjectFields<Nullable extends boolean | undefined> = { title?: string; description?: string; externalDocs?: OasExternalDocs | undefined; properties?: Record<string, OasSchema | OasRef<"schema"> | CustomValue> | undefined; required?: string[] | undefined; default?: Nullable extends true ? Record<string, unknown> | null | undefined : Record<string, unknown> | undefined; additionalProperties?: boolean | OasSchema | OasRef<"schema"> | undefined; nullable?: Nullable; maxProperties?: number; minProperties?: number; enums?: Nullable extends true ? (Record<string, unknown> | null)[] | undefined : Record<string, unknown>[] | undefined; extensionFields?: Record<string, unknown>; example?: Nullable extends true ? Record<string, unknown> | null | undefined : Record<string, unknown> | undefined; readOnly?: boolean; writeOnly?: boolean; deprecated?: boolean; }
  Constructor fields for {@link OasObject}.

  @template Nullable
      Whether the object can be null (affects type unions)
```
### `core/oas/union/Union.ts`

```text
Defined in deno/core/oas/union/Union.ts:147:1

class OasUnion extends OasBase
  Represents a union type schema in the OpenAPI Specification.

  `OasUnion` handles both OpenAPI `oneOf` and `anyOf` constructs by mapping them
  to TypeScript union types. While OpenAPI distinguishes between these concepts,
  in TypeScript they both represent union types (A | B | C), making the distinction
  less meaningful for code generation.

  This class supports both simple unions and discriminated (tagged) unions through
  the discriminator property, which enables more precise type narrowing in generated code.

  ## Key Features

  - Union Types: Represents multiple possible schema types as a single union
  - Tagged Unions: Supports discriminator properties for type narrowing
  - Reference Resolution: Handles references to other schemas within union members
  - Nullable Support: Can represent nullable union types (A | B | null)
  - JSON Schema: Converts to standard JSON Schema format for validation

  @example
      Basic union type

      ```typescript
      import { OasUnion, OasString, OasInteger } from '@skmtc/core';

      const stringOrNumber = new OasUnion({
        title: 'StringOrNumber',
        description: 'A value that can be either a string or number',
        members: [
          new OasString({ title: 'String Value' }),
          new OasInteger({ title: 'Integer Value' })
        ]
      });

      // This represents: string | number
      ```

  @example
      Discriminated union (tagged union)

      ```typescript
      const shape = new OasUnion({
        title: 'Shape',
        description: 'Different types of geometric shapes',
        discriminator: new OasDiscriminator({
          propertyName: 'type',
          mapping: {
            'circle': '#/components/schemas/Circle',
            'square': '#/components/schemas/Square'
          }
        }),
        members: [
          new OasRef({ $ref: '#/components/schemas/Circle' }),
          new OasRef({ $ref: '#/components/schemas/Square' })
        ]
      });

      // This creates a tagged union that can be narrowed by the 'type' property
      ```

  @example
      Nullable union

      ```typescript
      const nullableStatus = new OasUnion({
        title: 'NullableStatus',
        nullable: true,
        members: [
          new OasString({ enum: ['active', 'inactive'] }),
          new OasString({ enum: ['pending', 'suspended'] })
        ],
        default: null
      });

      // This represents: ('active' | 'inactive' | 'pending' | 'suspended') | null
      ```

  @example
      Complex nested union

      ```typescript
      const apiResponse = new OasUnion({
        title: 'ApiResponse',
        description: 'Response from API endpoint',
        members: [
          new OasObject({
            title: 'SuccessResponse',
            properties: {
              success: new OasBoolean({ default: true }),
              data: new OasObject({ additionalProperties: true })
            }
          }),
          new OasObject({
            title: 'ErrorResponse',
            properties: {
              error: new OasString(),
              code: new OasInteger()
            }
          })
        ]
      });

      // This represents: { success: boolean; data: Record<string, any> } | { error: string; code: number }
      ```

  @example
      Using with references

      ```typescript
      const userOrAdmin = new OasUnion({
        title: 'UserOrAdmin',
        description: 'Either a regular user or an admin user',
        members: [
          new OasRef({ $ref: '#/components/schemas/User' }),
          new OasRef({ $ref: '#/components/schemas/Admin' })
        ]
      });

      // References will be resolved during processing
      // This represents: User | Admin
      ```


  constructor(fields: UnionFields, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "union"
    Constant value 'union' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the union.
  description: string | undefined
    A description of the union.
  externalDocs: OasExternalDocs | undefined
    External documentation for the union.
  nullable: boolean | undefined
    Indicates whether value can be null.
  discriminator: OasDiscriminator | undefined
    Discriminator object used to tag member types and make the union a tagged union.
  members: (OasSchema | OasRef<"schema">)[]
    Array of schemas or references to schemas that are part of the union.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example?: unknown
    An example of the union type.
  default?: unknown
    The default value of the union type.
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasUnion
  resolveOnce(): OasUnion
  toJsonSchema(options: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject

Defined in deno/core/oas/union/Union.ts:14:1

type UnionFields = { title?: string; description?: string; externalDocs?: OasExternalDocs | undefined; nullable?: boolean; discriminator?: OasDiscriminator; example?: unknown; default?: unknown; members: (OasSchema | OasRef<"schema">)[]; extensionFields?: Record<string, unknown>; }
  Constructor fields for {@link OasUnion}.
```
### `core/oas/unknown/Unknown.ts`

```text
Defined in deno/core/oas/unknown/Unknown.ts:23:1

class OasUnknown extends OasBase
  Object representing an unknown type in the OpenAPI Specification.

  JSON schema treats a definition without any type information as 'any'.
  Since this is not useful in an API context, we use OasUnknown to
  represent types that are not specified.

  constructor(fields: UnknownFields, context?: ParseContextType)
  oasType: "schema"
    Object is part the 'schema' set which is used
    to define data types in an OpenAPI document.
  type: "unknown"
    Constant value 'unknown' useful for type narrowing and tagged unions.
  title: string | undefined
    A short summary of the unknown type.
  description: string | undefined
    A description of the unknown type.
  extensionFields: Record<string, unknown> | undefined
    Specification Extension fields
  example: unknown | undefined
    An example of the unknown type.
  nullable: boolean | undefined
    Whether the unknown type is nullable
  isRef(): this is OasRef<"schema">
  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
  resolve(): OasUnknown
  resolveOnce(): OasUnknown
  toJsonSchema(_options?: ToJsonSchemaOptions): OpenAPIV3.NonArraySchemaObject | OpenAPIV3.ArraySchemaObject

Defined in deno/core/oas/unknown/Unknown.ts:8:1

type UnknownFields = { title?: string; description?: string; extensionFields?: Record<string, unknown>; example?: unknown; nullable?: boolean; }
```
### `core/oas/ref/Ref.ts`

```text
Defined in deno/core/oas/ref/Ref.ts:157:1

class OasRef<T extends OasRefData["refType"]> extends OasBase
  Represents an OpenAPI reference ($ref) in the SKMTC OAS processing system.

  The `OasRef` class handles OpenAPI JSON Reference Objects that point to reusable
  components within the same document. It provides type-safe reference resolution
  with support for chained references and circular reference detection.

  ## Key Features

  - Type Safety: Generic parameter ensures resolved types match the reference type
  - Lazy Resolution: References are resolved on-demand, not during construction
  - Chain Resolution: Handles references that point to other references
  - Circular Detection: Prevents infinite loops with maximum lookup limits
  - Type Validation: Ensures resolved objects match expected reference types

  @template T
      The type of component this reference points to

  @example
      Basic reference resolution

      ```typescript
      import { OasRef } from '@skmtc/core';

      // Reference to a schema component
      const userRef = new OasRef<'schema'>({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, document);

      // Resolve the reference
      const userSchema = userRef.resolve();
      console.log(userSchema.properties); // Access resolved schema properties
      ```

  @example
      Working with different reference types

      ```typescript
      // Schema reference
      const schemaRef = new OasRef<'schema'>({
        refType: 'schema',
        $ref: '#/components/schemas/Product'
      }, document);

      // Response reference
      const responseRef = new OasRef<'response'>({
        refType: 'response',
        $ref: '#/components/responses/ErrorResponse'
      }, document);

      // Parameter reference
      const paramRef = new OasRef<'parameter'>({
        refType: 'parameter',
        $ref: '#/components/parameters/PageSize'
      }, document);
      ```

  @example
      Reference checking and conditional resolution

      ```typescript
      function processSchemaOrRef(schema: OasSchema | OasRef<'schema'>) {
        if (schema.isRef()) {
          // Handle reference
          const refName = schema.toRefName();
          console.log(`Processing reference: ${refName}`);

          // Resolve only when needed
          const resolved = schema.resolve();
          return processed(resolved);
        } else {
          // Handle direct schema
          return process(schema);
        }
      }
      ```

  @example
      Chained reference handling

      ```typescript
      // References can point to other references
      const chainedRef = new OasRef<'schema'>({
        refType: 'schema',
        $ref: '#/components/schemas/AliasToUser'
      }, document);

      // resolve() automatically follows the chain
      const finalSchema = chainedRef.resolve(); // Follows chain to final schema

      // resolveOnce() resolves only one step
      const oneStep = chainedRef.resolveOnce(); // May still be a reference
      ```


  constructor(fields: RefFields<T>, context: ParseContextType)
    Creates a new OAS reference instance.

    @param fields
        Reference field data including refType and $ref

    @param document
        Discriminated document containing the referenced
        component. For OAS, refs resolve through the document's components;
        for GQL, through the document's registry (GQL only ever creates
        schema refs).

  oasType: "ref"
    OAS type identifier
  type: "ref"
    Type identifier
  isRef(): this is OasRef<T>
    Type guard to check if this instance is a reference.

    @return
        Always true for OasRef instances

  resolve(lookupsPerformed: number): ResolvedRef<T>
    Recursively resolves this reference to its final target component.

    Follows reference chains until reaching a non-reference component,
    with protection against infinite loops.

    @param lookupsPerformed
        Internal counter to prevent infinite recursion

    @return
        The resolved component

    @throws
        Error if maximum lookup depth is exceeded

  resolveOnce(): OasRef<T> | ResolvedRef<T>
    Resolves this reference one level. Dispatches on the document's
    protocol — OAS reads from `document.components.<bucket>`; GQL
    reads from `document.registry.schemas`.

    @return
        Either the resolved component or another reference in the chain

  toRefName(): RefName
  isSchemaRef(): this is OasRef<"schema">
    Narrows this reference to a schema reference.

    @return
        True when this reference points at a schema component.

  traverse(path: SchemaPath): OasSchema | OasRef<"schema">
    Navigate an {@link SchemaPath} starting from this reference, resolving it
    to descend through. See {@link traverseSchema}.

    Available on every `OasRef` so `.traverse()` works on the common
    `OasSchema | OasRef<'schema'>` value (an object property, array `items`).
    Schema paths only describe schemas for now, so it throws for non-schema
    refs (response/parameter/…); {@link isSchemaRef} narrows `this`, keeping the
    delegation cast-free.

    @return
        The schema at the path (may be an unresolved `$ref`).

    @throws
        Error when called on a non-schema ref.

  get $ref(): string
  get refType(): OasRefData["refType"]
  get nullable(): boolean | undefined
    Use-site nullability of this reference (see {@link RefFields.nullable}).
    The getter exists on the prototype, so `'nullable' in ref` is always
    true and the value-function nullable read picks it up uniformly.
  get document(): SkmtcParsedDocument
    Returns the discriminated parsed document this ref resolves
    through. OAS variant carries the parent `OasDocument`; GQL variant
    carries the parent `GqlDocument` (whose registry holds the
    schemas).
  toJsonSchema({resolve}: ToJsonSchemaOptions): OpenAPIV3.ReferenceObject | ResolvedRefJsonType<T>
  toJSON(): object

Defined in deno/core/oas/ref/Ref.ts:382:1

type OasComponentType = OasSchema | OasResponse | OasParameter | OasExample | OasRequestBody | OasHeader | OasSecurityScheme | OasLink
  Union type of all OAS component types that can be referenced.

  Includes all OpenAPI component types that support $ref resolution.

Defined in deno/core/oas/ref/Ref.ts:55:1

type RefFields<T extends OasRefData["refType"]> = { refType: T; $ref: string; nullable?: boolean; }
  Field data for creating OAS reference objects.

  @template T
      The type of component being referenced (e.g., 'schema', 'response')


Defined in deno/core/oas/ref/Ref.ts:397:1

type ResolvedRef<T extends OasRefData["refType"]> = Extract<OasComponentType, { oasType: T; }>
  Type representing a resolved reference to a specific component type.

  @template T
      The type of component being referenced (e.g., 'schema', 'response')


Defined in deno/core/oas/ref/Ref.ts:373:1

type ResolvedRefJsonType<T extends OasRefData["refType"]> = ReturnType<ResolvedRef<T>["toJsonSchema"]>
  Type representing the JSON schema result from resolving a reference.

  @template T
      The type of component being referenced
```
### `core/oas/discriminator/Discriminator.ts`

```text
Defined in deno/core/oas/discriminator/Discriminator.ts:5:1

class OasDiscriminator

  constructor(fields: DiscriminatorFields)
  oasType: "discriminator"
  propertyName: string
  mapping?: Record<string, string>

Defined in deno/core/oas/discriminator/Discriminator.ts:0:1

type DiscriminatorFields = { propertyName: string; mapping?: Record<string, string>; }
```
### `core/dsl/CustomValue.ts`

```text
Defined in deno/core/dsl/CustomValue.ts:97:14

function isCustomValue(value: unknown): value is CustomValue
  Type guard function to check if a value is a CustomValue instance.

  @param value
      Value to check

  @return
      True if the value is a CustomValue, false otherwise

  @example
      Type checking

      ```typescript
      if (isCustomValue(someValue)) {
        console.log(someValue.value); // TypeScript knows it's a CustomValue
      }
      ```


Defined in deno/core/dsl/CustomValue.ts:30:1

class CustomValue extends SnippetBase
  Represents a custom value in the SKMTC generation pipeline.

  CustomValue allows generators to create arbitrary content that doesn't fit
  standard schema types. Used for injecting custom code, templates, or specialized
  content during the generation process.

  @example
      Creating custom content

      ```typescript
      const customValue = new CustomValue({
        context: generateContext,
        value: 'const customCode = "generated";',
        generatorKey: 'my-generator'
      });

      console.log(customValue.toString()); // "const customCode = "generated";"
      ```


  constructor({context, value, generatorKey}: CreateArgs)
    Creates a new CustomValue instance.

    @param args
        Creation arguments including context, value, and optional generator key

  type: "custom"
    Type identifier for this custom value
  value: Stringable
    The underlying value content that can be converted to string
  isRef(): this is OasRef<"schema">
    Determines if this custom value is a reference.

    @return
        Always false since custom values are concrete content, not references

  resolve(): CustomValue
    Resolves this custom value.

    @return
        The custom value itself since it's already resolved

  resolveOnce(): CustomValue
    Resolves this custom value one level.

    @return
        The custom value itself since it's already resolved

  override toString(): string
    Converts the custom value to its string representation.

    @return
        String representation of the underlying value


Defined in deno/core/dsl/CustomValue.ts:6:1

private type CreateArgs = { context: GenerateContextType; value: Stringable; generatorKey?: GeneratorKey; }
```

<!-- api-appendix:end -->
