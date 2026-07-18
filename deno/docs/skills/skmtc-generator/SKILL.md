---
name: skmtc-generator
version: 0.6.3
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
- **Constructor and `toString` are the only methods — get/set
  accessors included.** A producer with additional methods is being
  used as a service object or a string-builder — decompose that logic
  into delegate Snippets composed via `${...}` instead
  (orchestrator–delegate card, §10). A JS getter is still a method: a
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
    const schema = context.resolveSchemaRefOnce(refName, MyGen.id)
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

Non-TypeScript language layers are **pre-alpha and have no skills
yet** — read the lang package's source directly for its exact export
names, and treat the `skmtc-lang-typescript` skill as the template
for what a language layer covers (it is the model for future
`skmtc-lang-<X>` skills). Keep the target language's conventions in
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

1. **Read the lang package** — its projection-base factory, snippet
   base, and `Definition`/`File` classes. Its source shows exactly
   how it calls core, which is all the core knowledge you need.
2. **Scaffold immediately** — transliterate §6's A–C with the lang
   imports swapped, register the generator in the project
   `deno.json`, and run `skmtc bundle` within your first few
   actions.
3. **Let the toolchain teach** — bundle/typecheck errors name the
   exact signature you got wrong, one at a time. They are a faster
   and more reliable teacher than engine source: the factory's
   generics check your config either way, so pre-reading core buys
   certainty you get for free at bundle time.

If you genuinely need one core signature, look at how the lang
package uses it before reaching for core source. Auditing the engine
to de-risk the first line is unbounded in cost and the risk it
retires is already retired by the type checker.

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
```

Then, matching scaffolds A–D: implement `isSupported` in `src/mod.ts`;
`toIdentifierName` / `toIdentifierType` / `toExportPath` in
`src/base.ts` (the lang import here declares the target language);
the Projection in `src/<MainProjection>.ts`; decompose into Snippets
(scaffold E) as needed; always create `src/enrichments.ts` (scaffold
D — `emptyEnrichmentSchema` when there are no user options). Iterate
with `skmtc dev <project>`.

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
