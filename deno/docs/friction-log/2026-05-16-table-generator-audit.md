# 2026-05-16 — Table generator principles audit

Conducted a self-audit of `@fieldplan/gen-shadcn-table` (authored
yesterday — see `2026-05-16-table-generator-poc.md`) against the
generator skill's principles (§1, §4, §8) and verification checklist
(§9), then applied 10 fixes one by one. Net result: removed one `as`
cast, one dead method, one dead field; promoted the filters hook to
a tracked Definition; added Zod cross-gen for runtime response
validation; moved the enrichment gate from `transform` into
`isSupported`. The fix-application surfaced several genuinely-new
SKMTC observations that didn't come up during the POC.

## Knowledge acquired

Retrofitting an LLM-authored generator into closer alignment with
SKMTC's architectural model — both the engine's runtime contracts
and the skill's stated principles.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | **`IsSupportedOasOperationConfigArgs<E>` includes `enrichments` and `context`, not just `operation` and `variant`.** The skill's scaffold C (§6) destructures only `{ operation, variant }`, which I took as the canonical signature — so I'd been calling `ShadcnTableBase.toEnrichments({ operation, context, variant })` from inside `transform` to access enrichments. The actual type has all four fields. Reading enrichments inside `isSupported` is one line, not a re-derivation. | Scaffold C in §6 should either destructure all four args (and comment which are usually unused) or call out that `enrichments` is available. Real discoverability gap. |
| K2 | **`defineAndRegister` accepts `noExport: true` for module-private constants.** Used it for the per-table Zod response schema — consumers don't need to import it, only the table's `queryFn` references it. Without `noExport`, every sibling Definition is `export const`. The skill mentions the helper but not this flag. | §3 (cross-gen helpers table row for `defineAndRegister`) should add a one-liner: "set `noExport: true` for module-private constants (the Definition is still cache-keyed and manifest-tracked, just not exported)." |
| K3 | **`insertNormalizedModel` against multiple peer Projections on the same unresolved `OasRef` is coordinated by design.** Calling `insertNormalizedModel(TsProjection, { schema: ref })` AND `insertNormalizedModel(ZodProjection, { schema: ref })` against the same items ref reuses **both** existing named Definitions — `QuotingQuoteListItemDto` (type, from `gen-typescript`) and `quotingQuoteListItemDto` (schema, from `gen-zod`) — in a single emitted file. Both peer generators independently key off the same ref name and share an export path. No coordination overhead in my code; the engine handles it. | The skill describes cross-gen via `insertNormalizedModel` (§3, §3.5) but doesn't show the **multi-peer pattern**. A scaffold or example: "to get both the TS type and Zod schema for the same DTO, call `insertNormalizedModel` against both peer Projections — same schema arg, both Definitions reused if the ref already has named output." |
| K4 | **`register` is idempotent across separate calls for the same module key, with names merged into one import statement.** I'd written manual dedup logic (15 lines) to merge row-component and row-skeleton imports when they came from the same path. Replaced it with two separate `register` calls and the engine emitted `import { Row, RowSkeleton } from 'X'` correctly. The skill says register is idempotent (§4) but doesn't make the **multi-call merge** explicit. | Generator skill §4 ("Defensive `if (!already-registered)`") → expand to mention: "multiple `register` calls with the same module key are merged at render time — the engine produces a single import statement with all named imports deduplicated." |
| K5 | **`isSupported` gating on enrichment presence is legitimate when no defaultable emission exists.** The skill (§4 / §8) calls this an anti-pattern: "gating on enrichment forces a sentinel for 'default values'." But that reasoning depends on the generator HAVING default behavior to gate. For generators where every emission requires a consumer-supplied pointer (a row component, an action handler, etc.) — *no defaultable rendering exists* — "enrichment present" is part of the capability claim, not user-intent. There's no sentinel-vs-empty case because there's no sentinel. The anti-pattern's reasoning has a real carve-out. | §4 / §8 of the generator skill should add a clarification: "this anti-pattern assumes the generator has defaultable behavior. Generators whose emission requires a consumer-supplied non-defaultable pointer (handwritten component, callback, etc.) legitimately treat enrichment presence as capability — there is no sentinel-vs-empty case to confuse." |
| K6 | **Multiple Definitions sharing one `exportPath` render as sibling top-level declarations in registration order.** Filter hook + response schema + table component all registered at `@/components/tables/QuotesTable.generated.tsx`. The Driver emits them as three `export const` (or `const` for `noExport`) declarations in the order their constructors landed. Forward references between them just work because TS hoists `const` declarations. | The skill's §2 decision tree (Projection vs Snippet) implies one Projection per file. The truth is: one Projection per `(name, exportPath)` cache key — and multiple keys can share an exportPath. Worth a sentence in §3 ("Multiple Definitions can share an `exportPath`; they render as sibling top-level declarations in registration order"). |
| K7 | **`@skmtc/gen-zod` exports `ZodProjection` for cross-gen, same shape as `TsProjection` from `@skmtc/gen-typescript`.** The skill's scaffolds (§6 B) show `TsProjection` cross-gen but not `ZodProjection`. They're a matched pair: when emitting code that needs both the runtime schema and the TS type for the same DTO, use both. | §6 scaffolds could pair these. Or add an explicit "Cross-gen with multiple peer generators" section. |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `isSupported` scaffold hides enrichments/context args | friction | open |
| 2 | "Gating on enrichment is anti-pattern" rule has an unstated carve-out | friction | open |
| 3 | `noExport` flag on `defineAndRegister` is undocumented | polish | open |
| 4 | Inline-emitted helper smuggled inside another Projection's `toString()` | win | open |
| 5 | Multi-peer `insertNormalizedModel` for type + zod pairing | win | open |

---

### 1. `isSupported` scaffold hides enrichments/context args [friction]

User directed me to move the enrichment-presence check from `transform`
to `isSupported`. I'd assumed `isSupported` only had access to
`{ operation, variant }` — based on the scaffold in §6 C of the
generator skill — and would need `context` to compute enrichments.

**What happened:** Before the fix, my code was:

```ts
// mod.ts
transform({ context, operation, variant }) {
  const enrichments = ShadcnTableBase.toEnrichments({ operation, context, variant })
  if (!enrichments?.rowComponent) return
  context.insertOperation({ projection: ShadcnTable, operation, variant })
}
```

I'd internalised "`isSupported` gets only `operation`/`variant`" from the
skill's scaffold:

```ts
// generator skill §6 C
isSupported({ operation, variant }: IsSupportedOasOperationConfigArgs<EnrichmentSchema>) {
  return ['post', 'put', 'patch'].includes(operation.method) &&
    operation.requestBody?.resolve()?.toSchema()?.resolve().type === 'object'
}
```

To verify, I grepped `IsSupportedOasOperationConfigArgs` in core:

```ts
export type IsSupportedOasOperationConfigArgs<EnrichmentType = undefined> = {
  context: GenerateContextType
  operation: OasOperation
  enrichments: EnrichmentType
  variant: string
}
```

All four fields present. Including `enrichments` directly. The
scaffold's `{ operation, variant }` is a partial destructure of a
richer args object — but reads as if those are the only available
fields.

**What was expected:** that the scaffold's destructure pattern was
the complete arg surface. (It isn't — TS doesn't care that I omit
fields when destructuring.)

**Why it matters:** This is a pure documentation/discoverability
issue. The scaffold is the canonical reference for "what arguments
does my callback have?" — if the scaffold doesn't show an
argument, an LLM author won't reach for it. The fix in `transform`
(call `toEnrichments` manually with `context`) is a workaround that
happens to work but doubles the indirection and obscures the
simpler path.

The generator skill is generally excellent at flagging "you need
this principle"; this case is the inverse — it under-shows the
arg surface and an LLM reasonably reads the scaffold as exhaustive.

**Possible fixes:** unresolved. The scaffold could destructure all
four args with a comment marking the ones usually unused. Or the
intro to §6 C could say "all four args are available; the scaffold
destructures only the ones it uses." Or the typedef block elsewhere
in the skill could be the place that's complete.

**Version anchor:** `@skmtc/core@0.5.1`, generator skill as of the
2026-05-16 snapshot. Observed during `gen-shadcn-table` audit.

**Status:** open

---

### 2. "Gating on enrichment is anti-pattern" rule has an unstated carve-out [friction]

The generator skill's §4 / §8 lists "Use `isSupported` to opt the
generator in/out per-operation based on whether an enrichment is
present" as an anti-pattern, with the reasoning:

> "Once enrichment-presence is the switch, an enrichment with
> all-default values can't exist — you have to invent a sentinel."

This reasoning is correct *only* if the generator has defaultable
behavior. For a generator where every emission requires a consumer-
supplied non-defaultable pointer — a row component for a table, a
field-renderer module for a form variant, etc. — there are no
defaults. There's no sentinel-vs-empty confusion to invent around.
"No enrichment" means literally "cannot emit anything," not "emit
with defaults."

**What happened:** The user reviewed my generator and directed:
"transform short circuit should handled via isSupported call." I'd
initially defended my `transform`-gating in [the table generator POC
retro](./2026-05-16-table-generator-poc.md#K4) as a workaround for
the anti-pattern. The user's call (and the architectural fact of
`gen-shadcn-table`) made me realise the anti-pattern's reasoning
doesn't apply when there are no defaults — gating in `isSupported`
is the **correct** path here, not a workaround.

After the move:

```ts
isSupported({ operation, enrichments }: IsSupportedOasOperationConfigArgs<EnrichmentSchema>) {
  if (operation.method !== 'get') return false
  if (!enrichments?.rowComponent) return false  // ← part of capability claim
  // … response shape checks …
}

transform({ context, operation, variant }) {
  context.insertOperation({ projection: ShadcnTable, operation, variant })
}
```

This is cleaner than the `transform` short-circuit because:
1. The manifest now reports `unsupported` for un-enriched endpoints,
   rather than `supported but silently skipped`. Honest signal.
2. The engine's per-endpoint filtering is deterministic upstream of
   `transform`-dispatch rather than buried inside it.
3. The generator's capability claim ("supported iff GET + list shape
   + rowComponent provided") is a single readable predicate, not
   spread across two methods.

**What was expected:** the anti-pattern's strict-reading suggests
that any enrichment-presence check in `isSupported` is wrong, full
stop. My retro K4 yesterday tried to navigate around it via the
transform-gate workaround.

**Why it matters:** Anti-patterns with unstated carve-outs are the
worst kind of doc — they push LLM authors toward contortions
(transform short-circuits, sentinel enrichments, etc.) when the
clean answer is the thing the anti-pattern superficially forbids.
The carve-out condition is precise and worth stating:

> If the generator's emission requires a consumer-supplied non-
> defaultable pointer, `isSupported`'s capability claim legitimately
> includes "enrichment provides the pointer." There is no sentinel-
> vs-empty case because there is no default to sentinelise away from.

The carve-out applies cleanly to: tables (need a row component),
selectors (need primary/secondary field accessors that name DTO
properties, etc.), and any future "generator that emits a host for
consumer-supplied parts."

It does NOT apply to: forms (which can emit a default field for
every body property without enrichment), zod schemas (every property
has a default representation), TS types (same).

**Possible fixes:** unresolved. The skill could expand the existing
row in §4 with a "Unless …" clause, or add a sibling row stating
the carve-out positively. Either way, the carve-out should be
findable from the anti-pattern's own text — an LLM author hitting
this should be able to recognise themselves in it.

**Version anchor:** `@skmtc/core@0.5.1`, observed during
`@fieldplan/gen-shadcn-table` audit, refining the K4 observation in
[`2026-05-16-table-generator-poc.md`](./2026-05-16-table-generator-poc.md).

**Status:** open

---

### 3. `noExport` flag on `defineAndRegister` is undocumented [polish]

While promoting the per-table Zod response schema to a sibling
Definition (rather than emitting it inline inside the table's
`toString()`), I wanted the schema to be module-private — consumers
don't need to import it, the table's queryFn references it
directly.

**What happened:** Grepping `defineAndRegister` in core's
`GenerateContext.ts` showed:

```ts
defineAndRegister<V extends GeneratedValue>({
  identifier,
  value,
  destinationPath,
  noExport
}: DefineAndRegisterArgs<V>): Definition<V> { … }
```

`noExport: true` suppresses the `export` keyword in the rendered
output:

```ts
// without noExport:
export const QuotesTableResponseSchema = z.object({ … });

// with noExport: true:
const QuotesTableResponseSchema = z.object({ … });
```

Both are still tracked Definitions (cache-keyed, manifest-visible),
just with different consumer-facing surface area.

**What was expected:** I expected `defineAndRegister` to always
produce `export const`. The skill's §3 cross-gen-helpers table row
for `defineAndRegister` doesn't show the options object's full
shape, only the canonical 3-arg call:

> `context.defineAndRegister({ identifier, value, destinationPath })`

**Why it matters:** Module-private sibling Definitions are a real
use case — internal validation schemas, internal helper constants,
anything the file uses but doesn't expose. Without `noExport`, the
choices are:
- Emit `export const` and trust consumers not to import (bad — leaks
  internals)
- Emit the constant inline in the consuming Definition's `toString()`
  (smuggles a top-level declaration, anti-pattern per entry #4 below)
- Author a full Projection class just to override `toString()` /
  bypass the Driver's `export const` wrap (heavy)

`noExport: true` is the clean path.

**Possible fixes:** Add a one-line note to the §3 helpers row:

> `context.defineAndRegister({ identifier, value, destinationPath, noExport? })`
> — set `noExport: true` for module-private constants (still
> cache-keyed and manifest-tracked, just renders without `export`).

**Version anchor:** `@skmtc/core@0.5.1`, observed in
`@fieldplan/gen-shadcn-table@0.0.1`.

**Status:** open

---

### 4. Inline-emitted helper smuggled inside another Projection's `toString()` [win]

Authoring a generator that needs to emit multiple top-level
declarations in a single file is a real, recurring case. The
table generator emits THREE: the table component, the URL-filters
hook, and the response-validation Zod schema. My first cut emitted
all three by interpolating template literals inside one Projection's
`toString()`:

```ts
override toString(): string {
  return `(props: …) => { … }

${this.renderFiltersHook()}`  // emits `export const useQuotesTableFilters = …`
}
```

The Driver wraps the Projection's value as
`export const QuotesTable = ${value}`. Result on disk:

```ts
export const QuotesTable = (props: …) => { … }

export const useQuotesTableFilters = …  // ← smuggled second top-level export
```

Two top-level declarations from one Definition. The second one is
invisible to:
- `findDefinition({ name: 'useQuotesTableFilters', exportPath })` — returns nothing
- The manifest's artifact list — only shows `QuotesTable`
- Cross-gen `insertOperation` from a future peer generator that wants
  the hook
- The Driver's `affirmDefinition` integrity check
- Any future generator that wants to land another declaration in the
  same file — race conditions on duplicate `export const`

The fix is `context.defineAndRegister({ identifier, value, destinationPath })`
in the constructor, with `value` being the **arrow function expression
only** (no `export const` prefix — the Driver adds it). The hook then
becomes a proper sibling Definition with its own cache key, fully
visible to SKMTC's machinery, sharing the table's exportPath.

**Why this is a win:** The LLM-natural authoring path for "I want N
top-level exports in one file" is to template-literal them into one
Projection's `toString()`. It produces working output and looks like
it's working — but it bypasses every SKMTC invariant that depends on
each top-level export being a tracked Definition. The corrupted
state is silent until another generator (or a future change to the
generating one) tries to interact with the smuggled declaration.

The right pattern — `defineAndRegister` per sibling, all pointing at
the same `destinationPath` — is mentioned in passing in the skill
(§3 table row "Add a sibling Definition in a file you already own"),
but the pattern's **motivation** (avoid smuggling) and its
**implications** (cross-gen reachability, manifest visibility, name
hoisting in the rendered file) aren't spelled out together. Worth a
how-to.

The promotion refactor itself is small but conceptually significant:

```ts
// before — smuggled in toString()
override toString(): string {
  return `(props: …) => { … }

${this.renderFiltersHook()}`
}

// after — sibling Definition
constructor(args) {
  super(args)
  // …
  context.defineAndRegister({
    identifier: Identifier.createVariable(this.filtersHookName),
    value: this.renderFiltersHookValue(),  // arrow expression only
    destinationPath: settings.exportPath
  })
}

override toString(): string {
  return `(props: …) => { … }`
}
```

**Possible codification:** A new how-to in the generator skill —
"Emitting multiple top-level declarations in one file." Or a §3
expansion with this before/after as a worked example.

**Version anchor:** `@skmtc/core@0.5.1`, applied in
`@fieldplan/gen-shadcn-table@0.0.1` (Fix 9 of the audit pass).

**Status:** open

---

### 5. Multi-peer `insertNormalizedModel` for type + zod pairing [win]

For a generator that emits code needing **both** the TS type and the
Zod schema of the same DTO (e.g. for runtime response validation),
the pattern is two parallel cross-gen calls against the **same
unresolved ref**:

```ts
const itemsSchema = toItemsSchema(operation)  // returns OasRef<'schema'>, unresolved
const fallbackName = `${settings.identifier.name}Item`

this.itemTypeName = this.insertNormalizedModel(TsProjection, {
  schema: itemsSchema,
  fallbackName
}).identifier.name

this.itemSchemaName = this.insertNormalizedModel(ZodProjection, {
  schema: itemsSchema,
  fallbackName
}).identifier.name
```

Result: the emitted file imports **both** sibling Definitions from
the existing generated DTO file:

```ts
import {
  type QuotingQuoteListItemDto,  // ← from gen-typescript
  quotingQuoteListItemDto         // ← from gen-zod
} from '@/lib/api/generated/types/quotingQuoteListItemDto.generated.ts'
```

No duplication of either Definition — both peer generators have
their own `(name, exportPath)` cache key for this ref's emission,
both keys are hit, both are reused. The two Definitions share an
exportPath by convention (the `gen-zod`/`gen-typescript` pairing
emits both in the same file), which is why a single `import` line
in my emitted output covers both.

**Why this is a win:** The pattern is **invisible** until you need
it. The skill's §6 B scaffold shows `TsProjection` cross-gen only —
an LLM author following the scaffold will reach for `TsProjection`
and stop there. The Zod equivalent isn't shown anywhere in the
skill (`ZodProjection` is exported from `@skmtc/gen-zod`'s mod.ts
but nothing in the skill mentions it). If you need runtime
validation in emitted code, you have to discover this pairing by
analogy from the form generator's source — and even then, the form
generator uses `TanstackQuery` (which itself cross-gens the zod
schema internally), so it doesn't directly show the multi-peer
pattern at the consumer level.

For any generator that emits API-bound code (response parsing,
request shaping, list/detail hooks), this pattern is the right
answer. Wholesale-replicating the schema name + emitting `as`
casts is the LLM-natural alternative — and is what my generator
did pre-audit (entry #4 of the [POC retro](./2026-05-16-table-generator-poc.md)
also identified the resulting `as` cast as a defect).

**Possible codification:** A scaffold extension in §6 showing the
TS+Zod pairing, or a how-to titled "Cross-gen with multiple peer
generators for the same DTO." The takeaway: the pair `(TsProjection,
ZodProjection)` is a natural unit; calling `insertNormalizedModel`
on both with the same schema is supported and is the right answer
for runtime-validated emitted code.

**Version anchor:** `@skmtc/core@0.5.1`,
`@skmtc/gen-typescript@<local>`, `@skmtc/gen-zod@<local>`. Applied
in `@fieldplan/gen-shadcn-table@0.0.1` (Fix 10).

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #4 — Inline-emitted helper smuggled inside another Projection's `toString()` | This is the most common LLM-authoring trap for "I want multiple top-level exports in one file." The smuggled-declaration anti-pattern produces working output that silently fails every cross-gen, manifest, and integrity invariant. The fix is small (use `defineAndRegister`) but its motivation isn't spelled out anywhere. Future LLM-authored generators will hit this. | New how-to "Emitting multiple top-level declarations in one file" with the before/after worked example. Or expand §3 with the same. |
| 2 | #2 — "Gating on enrichment is anti-pattern" has an unstated carve-out | The current strict-reading pushes LLM authors toward `transform` short-circuits or sentinel enrichments when the clean answer is `isSupported`. The carve-out is precise ("no defaultable emission exists") and easy to state. | Add a "Unless …" clause to the relevant row in §4 / §8 — make the carve-out findable from the anti-pattern's own text. |
| 3 | #5 — Multi-peer `insertNormalizedModel` for type + zod pairing | LLM authors who need runtime validation in emitted code will either (a) discover this by reading the form generator's source, or (b) emit `as` casts and skip validation. The pattern is one extra line per cross-gen call; the skill needs to show it. | Scaffold extension in §6, or a how-to titled "Cross-gen with multiple peer generators." |
