# SKMTC for AI Assistants

A primer for AI coding assistants and agents working with SKMTC code. **Flat and self-contained** — every section is independent, ordered by priority rather than narrative. Skim once, then jump to whichever section your task needs.

> **If you read nothing else:** SKMTC is a TypeScript code generator. Generators are TypeScript classes that run inside a sandboxed Deno Worker. Cross-generator coordination is **memoization keyed by `(identifier.name, exportPath)`**, not a dependency graph. Most defaults from generic codegen patterns (Mustache templates, plugin registries, formatting passes, dependency ordering) do **not** apply here. Verify before stating.

---

## Quick reference

| Question | Answer |
|---|---|
| Where is the engine? | `skmtc/deno/core/` — `@skmtc/core` on JSR |
| Where is the CLI? | `skmtc/deno/cli/` — `@skmtc/cli` on JSR |
| Where are stock generators? | `skmtc-generators/gen-*/` — `@skmtc/gen-*` on JSR |
| Engine entry point | `core/run/toArtifacts.ts` |
| Pipeline phases | Parse, Generate, Render (engine) wrapped by Bootstrap, Spawn, Persist (CLI) |
| Phase boundary | Worker boundary; host parses OAS, worker parses GraphQL |
| Cross-generator coordination | `Map` cache keyed by `(name, exportPath)`, identifier and path are pure functions |
| Output format | Unformatted TypeScript; no Prettier in pipeline |
| Customization model | `install` (JSR, enrichments only) or `clone` (source, edit anything) |
| Settings file | `.skmtc/<project>/.settings/client.json` |
| Settings shape | `{ source, settings: { basePath, skip, include, enrichments } }` |
| Project workspace | `.skmtc/<project>/` containing `deno.json`, `worker.ts`, `bundle.js`, `.settings/` |
| Worker permissions | `read/write/env=true`, `net=false`, `run=false` |
| Worker lifecycle | One-shot: spawned per generate, terminated after RESULT |
| Agent context dump | `skmtc agent-context --json` |

---

## Reading priority by role and task

The user you're helping is in one of two roles. Identify which, then read only the sections listed.

### CLI user (running SKMTC, configuring projects)

| Task | Read these sections (in order) |
|---|---|
| Explain SKMTC to a user | Quick reference → Read this first → What SKMTC is → Pipeline |
| Set up a project | Quick reference → User task cards: Setup |
| Generate from a schema | Pipeline → User task cards: Generation |
| Debug a failed run | Verification → Anti-patterns: Pattern-level → User task cards: Debugging |
| Configure enrichments | Settings → User task cards: Configuring enrichments |
| Integrate with CI | User task cards: CI |

### Generator author (writing or editing generators)

| Task | Read these sections (in order) |
|---|---|
| Clone and customize a stock generator | Decision trees → DSL → Anti-patterns → Author task cards: Customizing |
| Author a new generator | DSL → Cross-generator coordination → Anti-patterns → Author task cards: Authoring |
| Debug wrong output | Verification → Anti-patterns → Author task cards: Debugging output |
| Understand cross-generator coordination | Cross-generator coordination → DSL |
| Swap a peer dependency | Customization seams → Author task cards: Swapping peer deps |

If unsure which role applies: read **Read this first** + **Verification protocol** + **What SKMTC is / is NOT**, then route by question.

---

## Read this first: five facts that override default LLM intuitions

These assertions are the ones you would most likely get wrong by extrapolating from other codegen tools (orval, openapi-generator, kubb, graphql-codegen).

1. **No plugin registry, no dependency graph, no topological sort.** Cross-generator coordination is a `Map<(name, exportPath), Definition>` cache. Generator order does not affect output.

2. **Render does not run Prettier or Biome.** No formatter runs inside `@skmtc/core`. Output is whatever generators produced. Consumers format their own output as a post-generation step.

3. **Generator source code is the customization surface.** Stock generators have hardcoded export paths and peer imports (`gen-shadcn-form/src/ShadcnForm.ts:1` hardcodes `import { TanstackQuery } from '@skmtc/gen-tanstack-query-supabase-zod'`). To customize beyond enrichments: `skmtc clone` and edit.

4. **`OasSchema` is a union type, not a class hierarchy.** `OasSchema = OasArray | OasBoolean | OasInteger | OasNumber | OasObject | OasString | OasUnknown | OasUnion`. Every variant independently implements `.isRef()` returning `false`. `OasRef` is a *sibling*, not a parent, with `.isRef()` returning `true`.

5. **The engine is language-blind; the language lives on the generator entry.** (core 0.7.1+) `toOasOperationEntry` / `toGqlOperationEntry` / `toModelEntry` take a required `lang` (e.g. `typescript` from `@skmtc/lang-typescript`); the engine resolves it by `generatorId` (`GenerateContext.resolveLang`) when creating files and building `Definition`s. Projection bases take no `lang`, snippets carry none, `register` passes plain data (`generatorId`, not a `Lang` or `createFile`). `Identifier`, `EntityType`, `sanitizePropertyName`, and the TS syntax helpers still import from `@skmtc/core` (F5/F6 in `notes/lang/09-migration-checklist.md` track the move).

---

## Operational principles for proposing changes

The five facts above are the *highest-priority* overrides. The table below is the broader operational principle list — apply these when proposing solutions for SKMTC code. Each row pairs a *default suggestion an LLM would reach for from generic TypeScript / codegen training data* with *what SKMTC actually requires*.

These overrides exist because well-intentioned TS conventions frequently break SKMTC's invariants. If your proposed solution matches the left column, the right column is almost always the correct alternative.

| Default intuition (from training data) | SKMTC's stance | Why |
|---|---|---|
| Add a config flag to make X customizable | `skmtc clone` the generator and edit | Customization is via source code, not configuration |
| Add a plugin API for extensibility | Generators coordinate via memoization; there is no plugin registry | Cross-generator coordination is a `Map` cache keyed by `(name, exportPath)` |
| Run Prettier or Biome in the pipeline | Don't — produce valid output and stop | Format is the consumer's concern; pipeline renders unformatted output by design |
| Provide a runtime client library | Output is committed source code | Zero SKMTC runtime in consumer bundles; generated files are reviewed via git |
| Fail closed on bad schema input | Fail open, log `ParseIssue`s, prune dependents via `removeErroredItems` | One bad schema mustn't kill the run; manifest is the canonical record |
| Templates as `.hbs` / `.mustache` files | Templates as template literals inside TypeScript classes | Type safety on interpolated values; full IDE refactoring |
| Cache between runs for speed | Each generate is from cold; spawn a fresh Worker per run | Determinism > marginal speed; no state leaks between runs |
| Make `OasSchema` a base class with subclasses | Keep it as a discriminated union of sibling classes | TS narrowing via `.isRef()` and `.type` discriminator beats runtime polymorphism |
| Use raw strings as identifier names | Use `Identifier.createVariable(name)` or `Identifier.createType(name)` | The entity kind drives declaration keywords and import forms in the language layer |
| Use `as` casts to satisfy types | Use type guards or runtime checks | `as` is reserved for tests; production code narrows |
| Long `if`/`else if` chains for 3+ branches | Use `switch` with exhaustive `never` default | Codebase convention; gets compiler help on missed cases |
| Use `process.env.X` | Use `Deno.env.get('X')` | Deno codebase; engine runs in Deno workers |
| Concatenate strings to build output | Template-literal interpolation with `${...}` | Composes with any `Stringable`; preserves Snippet recursion |
| Add defensive `if (!already-registered)` around `register` calls | Just call `register` | Already idempotent via Set / Map semantics |
| Mutate `this` inside `toString()` | Set state in the constructor; `toString()` must be pure | May be called multiple times (previews, integrity checks) |
| Read another generator's rendered source | Coordinate by *identifier name*, not source text | Use `insertOperation(Other, op).toName()` |
| Return content from `transform({ context, operation })` | Use `register({ definitions, ... })` or `insertOperation` | Return value is folded into `acc` and discarded |
| Write `import` statements inside template literals | Register imports via `this.register({ imports })` (own file) or `this.registerInto(path, { imports })` (cross-file) | Bypasses dedup; lands inside file body not header |
| Declare the language on the projection base or snippet | Declare `lang` once, on the entry (`toX…Entry({ lang })`) | The engine resolves language by `generatorId` (`resolveLang`); nothing else carries a `Lang` |
| Treat `acc` as a GQL-only quirk | All three entries are `transform({ …, acc, variant }) => Acc` with `Acc = void` by default; a declared `Acc` must be returned | The engine threads the accumulator through every visited item; dropping a declared `Acc` leaves downstream calls reading stale state |
| Give a Projection custom constructor args | Projections receive a fixed `{ context, operation/refName, settings }` from the Driver — re-resolve dependencies inside the constructor | The Driver never passes custom args; the memoization cache makes re-resolution free |
| Add a `BaseSchema` class to share schema behavior | Schema variants are sibling classes, not subclasses | Duck-typed `.isRef()` + discriminator narrowing is intentional |
| Use `Deno.writeFileSync` from a generator constructor | Use `register({ definitions, ... })` | Direct writes bypass `context.#files`; invisible to coordination and persistence |
| Mock a database in tests | Use real Supabase / real DB | Project convention — mocked tests previously masked production bugs |
| Hardcode generator-internal identifier names | Derive from operation/refName via `toIdentifier` | Hardcodes break the `(name, exportPath)` cache-key uniqueness |
| Suggest "make generation order deterministic" | It already is; coordinate via `insertOperation` | Order is structurally irrelevant; deterministic by construction |
| Add `@override` decorators or runtime type checks | Use TypeScript's structural typing + discriminated unions | Runtime overhead unnecessary; types catch this at compile time |
| Reach into `OasOperation` properties directly without `.resolve()` | Call `.resolve()` on `OasRef`-typed values; check `.isRef()` | The common parameter type is `OasSchema \| OasRef<'schema'>`; resolution is lazy |
| Look up a peer's emitted name with `Producer.toIdentifier(op).name` | Call `insertOperation(Producer, op).toName()` instead | Static lookup returns the name but skips four framework side effects: Definition registration, cross-File import registration, insertion order, and refactor re-resolution. The static call's emitted reference can fail to resolve at consumer compile time, fail to import at consumer compile time, hit TDZ at consumer runtime, or stop following a producer rename — none of those failures appear at the generator's typecheck. See [cross-generator-coordination § Why call `insertOperation`](concepts/cross-generator-coordination.md#why-call-insertoperation-instead-of-producertoidentifieropname) |
| Emit a file-scope export by calling `defineAndRegister` with a Snippet value | Make it a Projection, dispatch via `insertOperation` | A `defineAndRegister`'d Snippet is keyed by the caller-chosen name string, not by `(Producer.toIdentifier(op), Producer.toExportPath(op))`. Other generators cannot reach it via `insertOperation` (no class to pass); the identifier name lives at the caller, so a rename changes two sites instead of one |
| Return a duck-typed `{ toString: () => '...' }` from a helper function in a render path | Make it a `SnippetBase` descendant class | The duck-typed object has no `context` (so `register({ imports, destinationPath })` is unavailable), no `generatorKey` (invisible to `affirmDefinition`), and isn't `instanceof SnippetBase` (rejected by generic code over the family) |
| Expose a sole-caller-hardcoded value as a Snippet constructor parameter | Inline it in the Snippet's `toString()` template | Each parameter that all callers pass identically still adds call-site verbosity, typing surface, and an invitation for a mismatched-value bug — for zero gain |
| Use casual codegen verbs like *emit*, *dispatch*, *dispatcher*, *stitch* | Name the SKMTC primitive: `register`, `insertOperation`, `insertModel`, `insertNormalizedModel`, `defineAndRegister`, `findDefinition` | These words map to no exported surface in `@skmtc/core`. Using them in code or prose fabricates a mental model that doesn't connect to the API. See [glossary § SKMTC vocabulary](reference/glossary.md#skmtc-vocabulary--load-bearing-terms) |

Full discussion: [`explanation/design-philosophy.md`](explanation/design-philosophy.md). Code-level failure modes for these violations: see **Anti-patterns** below.

---

## Verification protocol

Before stating any architectural claim from this document, verify against the cited code:

1. **Read the cited file** at the line range given.
2. **Verify against implementation**, not docstrings or comments. Docstrings can drift; code is canonical.
3. **If cited code has moved**, search for the named symbol. Update mental model to the new location.
4. **If you cannot find the cited symbol**, treat the claim as potentially stale and flag uncertainty.

### Specific traps

| Trap | Reality | Verify against |
|---|---|---|
| "Render runs Prettier" | It doesn't — no formatter in the pipeline | `grep -r prettier core/` returns zero hits |
| "OasSchema has a base class" | It's a union type | `core/oas/schema/Schema.ts` |
| "insertNormalizedModel always integrity-checks" | Fallback-name path doesn't (`#SKM-47`) | `GenerateContext.ts:752-798` |
| "anyOf/oneOf preserve sibling properties when length 1" | They don't — siblings discarded | `toSchemasV3.ts:113` |
| "Generators can run in any order safely" | True for Driver paths; not for the `insertNormalizedModel` fallback | Both `insertNormalizedModel` branches |
| "The worker is reused across runs" | One-shot per run; `terminate()` after each | `cli/lib/generate-worker.ts:101` |
| "GraphQL is parsed host-side" | No, worker-side; OAS is host-side | `cli/lib/generate-worker.ts:42-60` |
| "Workers can make network requests" | `net: false` by default | `cli/lib/generate-worker.ts:75` |

**If you find a discrepancy between this document and the code, the code is canonical.** Flag the drift in your response so the docs can be updated.

---

## What SKMTC is

A code generator. Input: an OpenAPI v3 document or a GraphQL SDL string. Output: a tree of source files (TypeScript types, Zod schemas, React hooks, MSW mocks, forms, server routes) determined by installed generators. Generated files are idiomatic TypeScript committed to the consumer's repo.

Engine = `@skmtc/core`. CLI = `@skmtc/cli`. Stock generators = `@skmtc/gen-*`.

## What SKMTC is NOT

- **Not a runtime library.** Build-time only.
- **Not a templating engine.** Template literals inside TS classes, not Mustache/Handlebars/EJS files.
- **Not a plugin framework with a registry.** Generators are JSR packages or local TS files listed in `deno.json#imports`.
- **Not configurable like most codegen tools.** Customization model is *clone the source*, not *pass a flag*.
- **Not multi-language.** Stock generators produce TS/TSX.
- **Not always local.** `GenerateArtifacts.generateWithSandboxApi` posts to a remote service; default is local Worker.

---

## The pipeline

### Engine phases (run in Worker)

| Phase | Entry | Input | Output | Mechanism |
|---|---|---|---|---|
| **Parse** | `ParseContext.parse` (`core/context/ParseContext.ts:221`) | `SkmtcDocumentInput` | `SkmtcParsedDocument` + `ParseIssue[]` | Recursive descent; per-item isolation via `tryParseAt`; cascade pruning via `removeErroredItems` |
| **Generate** | `GenerateContext.toArtifacts` (`core/context/GenerateContext.ts:275`) | parsed doc + settings + generators | `Map<path, File>` | Two nested loops; Driver-based memoization; recursive constructor calls |
| **Render** | `RenderContext.collate` (`core/context/RenderContext.ts:176`) | `Map<path, File>` | `{ artifacts, files, manifest }` | Pure serialization; `file.toString()` joins reExports + imports + definitions |

### Orchestration phases (CLI)

| Phase | Location | Action |
|---|---|---|
| **Bootstrap** | `cli/commands/generate-switch.ts` | Load client.json; locate schema; locate bundle; check freshness |
| **Pre-parse** | `cli/lib/generate-worker.ts:42-60` | OAS → v3 (clone-safe); GraphQL stays SDL string |
| **Spawn worker** | `cli/lib/generate-worker.ts:70-81` | `new Worker(bundle, { permissions: {...} })` |
| **Message protocol** | `cli/lib/generate-worker.ts:83-122` | `READY` → `GENERATE` → `RESULT` (+ `ERROR` on throw) |
| **Persist** | `cli/lib/write-generated-files.ts` | Write artifacts under `basePath`; write `manifest.json` |
| **Exit** | `cli/commands/generate-switch.ts:144-152` | Exit 1 if fatal `parseIssue` or `--typecheck` failed |

### Worker boundary asymmetry

The structured-clone constraint forces this:

- **OAS:** parsed host-side; passed as plain JSON to worker. Worker re-parses into `OasDocument`.
- **GraphQL:** SDL stays a string until worker. Parsed `GqlDocument` has class instances with back-refs that don't survive `structuredClone`.

---

## The DSL: Projection vs Snippet

Both descend from `SnippetBase` (`core/dsl/SnippetBase.ts`). The differentiator: **does it have a name at file scope?**

| | Projection | Snippet |
|---|---|---|
| Base class | `ModelProjectionBase`, `OasOperationProjectionBase`, `GqlOperationProjectionBase` | `SnippetBase` (directly) |
| Static methods required | `id`, `type`, `toIdentifier`, `toExportPath`, `isSupported`, `toEnrichments` | None |
| Instance has | `settings: ContentSettings` | `context`, optional `generatorKey`, `register()` |
| Wrapped in `Definition` | Yes (by Driver) | No |
| Cached by | `(identifier.name, exportPath)` | Not cached |
| File-level export | Yes (`export const X = ...`) | No (embedded via `${...}`) |
| Reachable by other generators | Yes (via `insertOperation(MyProjection, op)`) | No |
| Concrete examples | `ShadcnForm`, `TanstackQuery`, `ZodProjection`, `TsProjection` | `FormFields`, `StringInput`, `SelectInput`, `CustomValue`, `Identifier` |

`Definition` extends `SnippetBase` — it's the wrapper that makes a Projection's value exportable. Drivers create `Definition`s automatically.

See [`concepts/projections-and-snippets.md`](concepts/projections-and-snippets.md).

---

## Cross-generator coordination

**Mechanism:** memoization cache on `context.#files`. Each `File` has a `definitions: Map<name, Definition>`. The cache key is `(identifier.name, exportPath)`. Identifier and exportPath are pure functions of `(operation, enrichments)` computed by static methods on the Projection class. Same inputs → same key → cached value reused.

**Code path** (for `ShadcnForm.constructor` calling `this.insertOperation(TanstackQuery, operation)`):

1. `OasOperationProjectionBase.insertOperation` (`core/dsl/operation/oas/OasOperationProjectionBase.ts:68-79`) auto-fills `destinationPath`, delegates to `context.insertOperation`.
2. `GenerateContext.insertOperation` (`core/context/GenerateContext.ts:722-746`) instantiates `new OasOperationDriver(...)`.
3. Driver computes `settings = context.toOperationContentSettings({ projection, operation })`.
4. Driver calls `getDefinition({ identifier, exportPath })` (`OasOperationDriver.ts:85-114`):
   - Cache hit + `affirmDefinition` passes: return cached.
   - Cache hit + generatorKey mismatch: throw `"Registered definition mismatch"`.
   - Miss: `new projection({...})` runs; wrap value in `Definition`; register in target file.
5. Driver stitches an import into the *calling* file if `exportPath !== destinationPath`.

**Cache integrity asymmetry:**

| Path | Integrity check | Same-name from different generator |
|---|---|---|
| `insertOperation` / `insertModel` (Driver) | `affirmDefinition` checks `generatorKey` and `instanceof projection` | Throws loudly |
| `insertNormalizedModel` ref branch (Driver via `insertModel`) | Same as above | Throws loudly |
| `insertNormalizedModel` fallback-name path | Name-only (`#SKM-47` TODO) | Silent merge |
| Direct `register({ definitions })` | None (`File.definitions.has(name)` gate) | First wins silently |

---

## Generators: install vs clone

### Install path (JSR-only)

- `skmtc install @skmtc/gen-x <project>` adds JSR specifier to `deno.json#imports`.
- No local source. Customization via enrichments only.
- No local `bundle.js`. JSR-published bundle used at generate time.

### Clone path (local source)

- `skmtc clone <project> -g @skmtc/gen-x` copies source into `.skmtc/<project>/gen-x/`. The `-g` flag is repeatable to clone multiple generators in one invocation.
- `deno.json#imports` entry becomes a local path.
- Next `skmtc bundle` regenerates `worker.ts` and runs `deno bundle worker.ts -o bundle.js`.
- The generator is now editable TypeScript.

### Customization seams in stock generators

| Seam | Location pattern | Customize by |
|---|---|---|
| Export path | `gen-x/src/base.ts` → `toExportPath` | Edit the `join('@', ...)` call |
| Identifier shape | `gen-x/src/base.ts` → `toIdentifier` | Edit the name-building expression |
| Peer dependency | `gen-x/src/<Main>.ts` top-level imports | Swap the import target |
| Consumer-side component path | `gen-x/src/fields/<X>.ts` register | Change the import key |
| Capability gate | `gen-x/src/mod.ts` → `isSupported` | Change the predicate |
| Enrichment schema | `gen-x/src/enrichments.ts` | Add Valibot fields |

---

## Decision trees

### Should I clone or install a generator?

```
Need to change identifier naming, export paths, peer deps, or output shape?
├── No  → install
└── Yes → clone, then edit src/base.ts or src/<Main>.ts
```

### Should this be a Projection or a Snippet?

```
Need its own name at file scope (export const X = ...)?
├── Yes → Projection (extends *ProjectionBase, has static toIdentifier/toExportPath)
└── No  → Snippet   (extends SnippetBase, anonymous, embedded via ${this.x})
```

### Where should generated string content go?

```
Final output text?       → SnippetBase descendant's toString() (template literal with ${...})
Import (own file)?        → this.register({ imports: { module: [names] } })
Import (another file)?    → this.registerInto(destinationPath, { imports }) — or, from a
                            Snippet, this.register({ imports, destinationPath })
Identifier name?          → Identifier.createVariable(name) or Identifier.createType(name)
File path?                → join('@', ...) from @std/path
TS fragment not in OAS?   → new CustomValue({ context, value: '...' })
```

### Why is my generator's output empty?

```
1. transform being called?              → Check the manifest
2. isSupported rejecting?               → Check the gate predicate
3. skip/include filters excluding?      → Check .settings/client.json
4. transform returning instead of registering?
                                        → Return value is discarded; must use register
5. Schema shape wrong for the gate?     → e.g., gen-shadcn-form needs request body type === 'object'
6. Engine threw "declares no 'lang'"?   → The entry is missing `lang` (e.g. `typescript`
                                          from @skmtc/lang-typescript)
7. Threw "not in the generator config map"?
                                        → A peer passed to insertOperation/insertModel
                                          isn't installed/configured in the project
8. Threw "Cannot register from a snippet that has no generatorKey"?
                                        → A registering Snippet wasn't given the parent's
                                          generatorKey (transitional — F7 in notes/lang/09)
```

---

## Settings and enrichments

### Top-level shape

```json
{
  "source": "./openapi.json",
  "settings": {
    "basePath": "src/generated",
    "skip": [],
    "include": [],
    "enrichments": { }
  }
}
```

### Enrichment routing

Routing keys are hardcoded per projection-base factory:

- OAS operation generators: `enrichments[generatorId][operation.path][operation.method][variant]`
- Model generators: `enrichments[generatorId][refName][variant]`
- GraphQL operation generators: `enrichments[generatorId][rootKind][fieldName][variant]`

The trailing `[variant]` level defaults to `'main'` when the consumer
writes no variants. Whenever any variant is declared, `'main'` MUST be
present (engine throws via `toVariantList` otherwise). See
[`concepts/variants.md`](./concepts/variants.md).

The payload shape beneath the routing keys is declared per-generator via Valibot in `gen-x/src/enrichments.ts`. **To know what keys a generator accepts, read its `enrichments.ts`.**

### Skip and include filters

Each accepts two forms:

```json
"skip": [
  "@skmtc/gen-zod",                                           // whole-generator
  { "@skmtc/gen-zod": { "/users": ["post"] } },               // per-operation
  { "@skmtc/gen-zod": ["UserModel"] }                         // per-model
]
```

Order: `isSupported` (capability) → `include` (allow) → `skip` (deny).

---

## Source map

### Engine — `skmtc/deno/core/`

| Concept | Path |
|---|---|
| Top-level transform function | `run/toArtifacts.ts` |
| Parse phase | `context/ParseContext.ts` |
| Generate phase | `context/GenerateContext.ts` |
| Render phase | `context/RenderContext.ts` |
| Core orchestrator | `context/CoreContext.ts` |
| Stack trail (location tracking) | `context/StackTrail.ts` |
| Per-item parse isolation | `context/tryParseAt.ts` |
| Parse issue types | `context/ParseIssue.ts` |
| Settings types | `types/Settings.ts` |
| Manifest types | `types/Manifest.ts` |
| OAS schema routing | `oas/schema/toSchemasV3.ts` |
| OAS schema variants | `oas/{object,array,union,string,integer,number,boolean,unknown}/<Name>.ts` |
| OAS ref class | `oas/ref/Ref.ts` |
| OAS document model | `oas/document/Document.ts` |
| OAS operation model | `oas/operation/Operation.ts` |
| `allOf` merging | `oas/_merge-all-of/merge.ts` |
| GraphQL parser | `gql/document/parseGqlDocument.ts` |

### DSL — `skmtc/deno/core/dsl/`

| Concept | Path |
|---|---|
| SnippetBase root | `SnippetBase.ts` |
| Definition (export wrapper) | `Definition.ts` |
| Identifier | `Identifier.ts` |
| EntityType | `EntityType.ts` |
| Import | `Import.ts` |
| File container | `File.ts` |
| ContentSettings | `ContentSettings.ts` |
| CustomValue (escape hatch) | `CustomValue.ts` |
| Operation projection base (OAS) | `operation/oas/OasOperationProjectionBase.ts` |
| Operation driver (OAS) | `operation/oas/OasOperationDriver.ts` |
| Operation projection base (GQL) | `operation/gql/GqlOperationProjectionBase.ts` |
| Operation driver (GQL) | `operation/gql/GqlOperationDriver.ts` |
| Model projection base | `model/ModelProjectionBase.ts` |
| Model driver | `model/ModelDriver.ts` |

### CLI — `skmtc/deno/cli/`

| Concept | Path |
|---|---|
| Entry point | `mod.ts` |
| Per-command implementations | `commands/<name>.tsx` |
| Generate command routing | `commands/generate-switch.ts` |
| Local generate | `lib/generate-local.ts` |
| Worker spawn + protocol | `lib/generate-worker.ts` |
| Worker package | `../worker/mod.ts` |
| Worker.ts template renderer | `lib/to-worker.ts` |
| Bundle implementation | `tasks/GenerateBundleTask.tsx` |
| Bundle freshness check | `lib/bundle-freshness.ts` |
| Agent context dump | `commands/agent-context.ts` |

### Stock generators — `skmtc-generators/gen-*`

Per-generator layout: `gen-x/{deno.json, mod.ts, src/{mod.ts, base.ts, enrichments.ts, <MainProjection>.ts, <Snippet>.ts}}`.

Reference example: `skmtc-generators/gen-shadcn-form/src/`.

---

## Invariants

| # | Invariant | Mechanism | Code |
|---|---|---|---|
| 1 | Identifier and exportPath are pure functions of input | Static methods take `{ operation, enrichments }`; no `this`, no async | `OasOperationProjectionBase.ts` (factory) |
| 2 | Generate side effects are idempotent | `register({ imports })` uses `Set.add`; `register({ definitions })` first-write-wins | `GenerateContext.ts:659-708` |
| 3 | Parse never throws to caller | `tryParseAt` wraps every per-item parser | `tryParseAt.ts:72-100` |
| 4 | `OasRef.resolve()` returns a typed-correct target | `resolveOnce` checks `oasType` matches expected | `Ref.ts:198-225` |
| 5 | Render does not modify file content | `renderFile` simply assembles `{ content: file.toString(), ... }` | `core/context/RenderContext.ts` (`renderFile` body) |
| 6 | Cross-generator coordination is order-independent | Cache by `(name, exportPath)`; deterministic identifiers | `OasOperationDriver.ts:85-114` |
| 7 | Worker is sandboxed | Deno permissions: `net: false`, `run: false` | `generate-worker.ts:70-81` |
| 8 | One worker per generate run | `worker.terminate()` after RESULT or ERROR | `generate-worker.ts:101` |
| 9 | OAS converted to v3 before worker | `toDocumentInput` calls `@skmtc/convert` for OAS | `generate-worker.ts:42-60` |
| 10 | Manifest is canonical run record | `manifest.parseIssues` populated; exit code from issue levels | `generate-local.ts:46-65` |

---

## Anti-patterns

### Pattern-level (generic codegen intuitions that don't apply)

| Anti-pattern | Why it fails |
|---|---|
| Writing strings outside `toString()` | File not in `context.#files`; invisible to coordination and persistence |
| Returning content from `transform()` | Return value is folded into `acc` and discarded |
| Raw `import` statements in template literals | Import lands in body not header; TS rejects; bypasses dedup |
| Hardcoded identifier names | Breaks cache-key uniqueness |
| Assuming generator order | Order isn't controllable; use `insertOperation` to declare dependencies |
| Suggesting "add a config option" to a stock generator | Customization is via cloning |
| Assuming Prettier formatting | Not in pipeline; consumer-side concern |
| Mutating `this` in `toString()` | May be called multiple times; set state in constructor |
| Reading another generator's `toString()` | Coordination is by *identifier name*, not source text |

### SKMTC-specific (code style and architectural invariants)

| Anti-pattern | Why it fails |
|---|---|
| Using `process.env.X` instead of `Deno.env.get('X')` | Deno codebase |
| Adding a `BaseSchema` class for `OasSchema` | Union is intentional, load-bearing for TS narrowing |
| Wrapping `register` in `if (!already)` | Already idempotent via Set/Map |
| Concatenating strings instead of template-literal interpolation | Loses composability with `Stringable` instances |
| Using `as` casts in production code | Use type guards; `as` is for tests only |
| Long `if/else` chains for 3+ branches | Codebase prefers `switch` with exhaustive `never` default |
| Direct mutation of `context.#files` | Private for a reason; go through `register` |
| Reading `OasSchema` params without first checking `isRef()` | The common parameter type is `OasSchema \| OasRef<'schema'>` |
| Calling `resolve()` without expecting cycle throw | `MAX_LOOKUPS = 10` will throw on cycles |

---

## Task cards

Self-contained playbooks. Read only the one you need.

### User task cards

#### Setting up SKMTC in a project

1. `deno install --allow-read --allow-write --allow-net --allow-env --allow-run=deno,sh --allow-sys=homedir -g --unstable-worker-options -n skmtc jsr:@skmtc/cli` (requires Deno). The `--unstable-worker-options` flag must be passed at install time — `@skmtc/worker` uses Deno's `Worker.deno.permissions` API, which sits behind this flag. Without it the first `skmtc generate` exits at runtime with `Unstable API 'Worker.deno.permissions'`.
2. `skmtc init <project-name> ./` creates `.skmtc/<project>/`.
3. `skmtc install @skmtc/gen-typescript @skmtc/gen-zod <project>` to add generators.
4. Edit `.skmtc/<project>/.settings/client.json` to set `source` and `settings.basePath`.
5. `skmtc generate <project>` runs the pipeline.

#### Adding a generator to an existing project

1. `skmtc install @skmtc/gen-<name> <project>` adds the JSR specifier to `deno.json`.
2. `skmtc generate <project>` — no rebundle needed if only installing.
3. If the project has any *cloned* generators, install also triggers a rebundle.

#### Configuring enrichments

1. Read the target generator's `gen-x/src/enrichments.ts` to know the accepted shape.
2. Open `.skmtc/<project>/.settings/client.json`.
3. Add under `settings.enrichments[generatorId][...routingKeys][variant]` — routing keys depend on factory: `[path][method]` for OAS ops, `[refName]` for models, `[rootKind][fieldName]` for GraphQL ops. The trailing `variant` level defaults to `'main'`; declare extra variants to get N artifacts per item from a variants-aware generator.
4. `skmtc generate <project>` (no rebundle needed).

#### Pinning a schema source

1. Edit `.skmtc/<project>/.settings/client.json`.
2. Add `source: "./path/to/openapi.json"` at the top level.
3. `skmtc generate <project>` (no schema argument) uses the pinned source.

#### Including or excluding operations

1. Edit `.skmtc/<project>/.settings/client.json`.
2. Per-operation: `settings.include = [{ "@skmtc/gen-x": { "/users": ["post"] } }]`.
3. Order: `isSupported` → `include` → `skip`. Empty `include: []` means no filter.

#### Debugging a failing generation

1. Re-run with `--json`: `skmtc generate <project> --json`.
2. Inspect `parseIssues` — `level: 'error'` causes exit 1.
3. Per-operation results in manifest: `'success' | 'notSupported' | 'skipped' | 'error'`.
4. No output for an operation: check `isSupported`, `skip`/`include`, schema shape.
5. Wrong output: bug is in the generator; clone for inspection.
6. Module not found: stock generators render consumer-side import paths; either implement those modules or clone the generator.

#### Updating a schema and regenerating

1. Update the schema source.
2. `skmtc generate <project>`. Files overwritten.
3. Files no longer produced are *not* auto-deleted — clean manually or run before generating.

#### Using SKMTC in CI

1. Pin Deno version.
2. Install CLI in CI: `deno install --allow-read --allow-write --allow-net --allow-env --allow-run=deno,sh --allow-sys=homedir -g --unstable-worker-options -n skmtc jsr:@skmtc/cli`. The flag is required (see "Setting up SKMTC in a project" above).
3. `skmtc bundle <project>` once at CI setup (only if generators are cloned).
4. `skmtc generate <project> --no-input --json --typecheck`.
5. Archive `manifest.json` as a CI artifact.

### Author task cards

#### Adding a new field type to gen-shadcn-form

**Prerequisite:** `skmtc clone <project> -g @skmtc/gen-shadcn-form`.

1. Create `.skmtc/<project>/gen-shadcn-form/src/fields/MyInput.ts` mirroring `StringInput.ts`.
2. Edit `src/schemaToField.ts`. Add a branch returning `MyInput`.
3. Implement consumer-side `MyField` component.
4. `skmtc dev <project>` for live rebundle + regenerate.

#### Customizing export paths

**Prerequisite:** Generator must be cloned.

1. Open `.skmtc/<project>/<gen-name>/src/base.ts`.
2. Find `toExportPath`. Edit path components.
3. `skmtc bundle <project>` then `skmtc generate <project>`.

#### Swapping the HTTP layer in gen-shadcn-form

**Prerequisite:** Both `gen-shadcn-form` and target HTTP generator installed/cloned.

1. Clone `gen-shadcn-form` if not already.
2. Edit `src/ShadcnForm.ts:1` — change the import target.
3. `skmtc bundle <project>` and regenerate.

#### Authoring a new generator

1. `skmtc create <project> <gen-name> operation` (or `model`).
2. Implement `isSupported({ operation })` in `src/mod.ts`.
3. Implement Projection constructor and `toString()`.
4. Decompose into Snippet classes as needed.
5. `skmtc dev <project>` to iterate.

#### Adding enrichment options to a generator

**Prerequisite:** Generator must be cloned.

1. Edit `gen-x/src/enrichments.ts`. Add fields to the Valibot schema.
2. Consume the enrichments in the Projection constructor via `this.settings.enrichments`.
3. Document the new keys for users.
4. Rebundle and regenerate.

#### Fixing a same-name collision error

If you see `Registered definition mismatch: 'X' in file 'Y'`:

1. Two generators are producing the same identifier at the same exportPath.
2. Read the two `generatorKey` values from the error.
3. **Both stock:** clone one and change `toIdentifier`.
4. **One yours:** make `toIdentifier` more specific (verb prefix, kind suffix, etc.).

#### Debugging a generator producing wrong output

1. Check insertOperation calls — right Projection instantiated?
2. Check schema reads — `operation.toRequestBody`, `operation.toSuccessResponse`, `schema.resolve()`.
3. Check template literal interpolation — `${this.x}` calls `x.toString()`.
4. Check constructor side effects — `register()` must be in constructor, not `toString()`.

### Shared task cards

#### Inspecting project state for an AI agent

`skmtc agent-context --json` produces a structured dump:
- Available commands and their descriptors
- Installed generators and their versions
- Settings and source pinning
- Recent run state

Use this as the first read when an agent enters a SKMTC project cold.

---

## Glossary

- **Projection** — a named, file-level generated artifact. Extends `*ProjectionBase`. Wrapped in `Definition`. Cached by `(name, exportPath)`.
- **Snippet** — an anonymous, embeddable generated fragment. Extends `SnippetBase`. Embedded via `${...}`.
- **Definition** — the `export const X = VALUE` wrapper around a Projection's value. Created by Drivers.
- **Driver** — the orchestrator for inserting a Projection: settings → cache check → instantiate → register.
- **Identifier** — a name + entity-type marker (`'variable'` vs `'type'`; `'variable'` renders as the TS keyword `const`). Created via `Identifier.createVariable` / `createType`.
- **ContentSettings** — `{ identifier, exportPath, enrichments }`. Computed by Drivers from the Projection's static methods.
- **Enrichment** — user-supplied config attached to a generator, declared per-generator via Valibot in `enrichments.ts`.
- **Generator** — a JSR package (or local TypeScript file) exporting an entry function.
- **Worker** — the sandboxed Deno Worker thread that runs the engine.
- **Bundle** — `bundle.js` produced by `deno bundle worker.ts -o bundle.js`.
- **Manifest** — `manifest.json` written after each generate run.
- **StackTrail** — the location-tracking accumulator threaded through parse and generate.
- **Stringable** — anything with a `toString()` method; the common interface for DSL composition.
- **clone-to-customize** — the design philosophy: stock generators are opinionated; non-default behavior comes from editing cloned source.
