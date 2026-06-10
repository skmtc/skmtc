# 2026-05-16 — Table generator POC

Authored `@fieldplan/gen-shadcn-table` from scratch — a virtualised
data-table generator for GET-list endpoints (`{ items, total }`-shaped
responses). Migrated five existing handwritten tables (`QuotesTable`,
`JobsTable`, `CustomersTable`, `InvoicesTable`, `LocationsTable`) to
use it. One handwritten table (`QuoteVisitsTable`) deliberately left
alone because its response shape is `data: <array>` not `data: { items,
total }` — a bounded sub-collection that the data-table pattern doc
endorses as a "don't paginate" case.

Parallels [`2026-05-16-selector-generator-poc.md`](./2026-05-16-selector-generator-poc.md)
— same day, same general shape of work (new operation-Entry
generator emitting an interactive consumer of a list endpoint),
different output kind. Two of the observations below cross-link to
that retro.

## Knowledge acquired

Authoring an operation-Entry generator from scratch and validating it
against five real list endpoints.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | **Workspace registration is a 3-place dance** for a new generator: (a) root `.skmtc/<project>/deno.json` `imports` map points at `./gen-<name>/mod.ts`; (b) the same `deno.json`'s `workspace` array lists `./gen-<name>`; (c) `worker.ts` imports the default and spreads it into the generator map. Missing any one fails silently (a Deno resolution error during bundle, or the generator simply never runs at generate time). | The skmtc-generator skill assumes you're customizing/cloning an existing generator. There's no end-to-end recipe for "author a new generator from scratch in a consumer project's `.skmtc/<project>/`". Worth a new task card in §10. |
| K2 | **`skmtc bundle` exit status disagrees with the actual bundle outcome.** The CLI reports `Error: bundle.js was expected at <path> but wasn't written` while `bundle.js` is in fact freshly written (verified by `stat` and by a subsequent `skmtc generate` reading it cleanly). The `error-logs.txt` shows a clean `Bundled 587 modules` line. Confused me until I checked the file timestamp. | Either a real bug in `bundleHeadless` (a race or a stale check), or the error is genuinely benign — either way, the contract is broken. Worth a CLI bug investigation; until then, document in `skmtc-debug` that this specific error can be ignored if `bundle.js` mtime is current. |
| K3 | **`insertNormalizedModel(TsProjection, { schema, fallbackName })` ref-vs-resolved semantics are load-bearing**: pass the **unresolved** ref to reuse an existing named Definition (so the emitted file `import`s the canonical type, e.g. `QuotingQuoteListItemDto` from `@/lib/api/generated/types/...generated.ts`); pass the **resolved** schema (`.resolve()`) and a NEW Definition is created at `fallbackName`, duplicating the inline shape under a generator-specific name. My first iteration resolved the items schema and got `export type QuotesTableItem = { id: string, ... }` inlined into the table file. Fixed by dropping the `.resolve()` call in the schema walker. | The generator skill §3.5 mentions the helper but doesn't make the ref-vs-resolved boundary explicit. Worth a one-liner: "to reuse an existing named-ref Definition, pass the unresolved `OasRef<'schema'>`; resolving it before passing creates a duplicate Definition under your fallback name." |
| K4 | **For "non-defaults-possible" generators, gate emission in `transform`, not `isSupported`.** The table generator can't emit usefully without a handwritten row component (no sensible default exists). Without an explicit gate, `isSupported`'s broad capability claim ("any GET list endpoint") makes the generator try to emit for every list endpoint, failing at construction-time with missing-enrichment invariants. The skill warns against gating `isSupported` on enrichment presence — but `transform` short-circuit (`if (!enrichments?.rowComponent) return`) is a legitimate variant. `isSupported` stays a capability claim; `transform` is where opt-in lives. | Worth a sibling note next to the "gate `isSupported` on enrichment is anti-pattern" row in §4 of the generator skill: "for generators where every emission requires a consumer-provided pointer (component, hook, etc.), short-circuit in `transform` — `isSupported` is still capability, not intent." |
| K5 | **`insertOperation(Peer, op)` bypasses the peer's skip list; hand-replicated naming does not.** Resolved post-retro by reading both generators' source. `gen-shadcn-form/src/FormOptionsType.ts:55` calls `this.insertOperation(TanstackQuery, operation)` — direct cross-gen via the Projection class — which materialises `useUpdateQuote.generated.ts` even though `/v2/quoting/quotes/{quoteId}` is in `gen-tanstack-query-fieldplan`'s skip list. `gen-shadcn-selector/src/ShadcnSelector.ts:15-37` replicates the hook-name algorithm and emits the import as a string literal — no `insertOperation` call → no cross-gen → the hook is subject to the peer's skip list normally. Both same-day POCs ([this retro](./2026-05-16-table-generator-poc.md), [`2026-05-16-selector-generator-poc.md#1`](./2026-05-16-selector-generator-poc.md)) observed the rule from opposite sides. | The generator skill §3 ("cross-generator coordination") describes the memoization cache but doesn't make the **skip-bypass property** of `insertOperation` explicit. Worth a paragraph: "`insertOperation` materialises the peer's emission regardless of the peer's own skip/include config; replicating naming + emitting a string import does not — that path requires the consumer's `client.json` to keep the peer's path enabled." Architecturally consistent (memoization runs at the cache level, skip filters at the Entry's `transform`-dispatch level) but the consequence for generator authors choosing between the two cross-gen styles isn't called out. |
| K6 | **Generated DTO type names follow `PascalCaseOf(snake_case schema name)` verbatim** — no doubled-prefix collapse. `customer_customer_list_item_dto` → `CustomerCustomerListItemDto` (doubled `Customer`). Took two grep cycles to find the right type when writing handwritten row files; my prior assumption (singular domain prefix) was wrong. | Worth a one-liner in the generator skill or a cli "type-name conventions" reference: "TS DTO types preserve the OAS snake_case verbatim; doubled domain prefixes are not collapsed." |
| K7 | **`EmptyState` requires `icon` (mandatory) and `action` as a structured `{ label, onClick, icon? }` object**, not `ReactNode`. My first iteration treated `emptyAction` as `ReactNode` and cast to `never` to satisfy the type — compiled but shipped a runtime-broken empty state until consumer typecheck failed. Lesson for generator authoring: never use `as never` in emitted code; it masks shape mismatches at consumer call sites. The right answer is to mirror the consumer component's prop shape exactly in the generator's emitted typing. | Worth a memory entry / generator skill anti-pattern row: "emitted code with `as never` or `as unknown` casts hides downstream type errors; the generator's output should produce real TS errors at the consumer when the consumer-provided shape is wrong." |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Spurious "bundle.js wasn't written" error from `skmtc bundle` | friction | open |
| 2 | `insertNormalizedModel` ref-vs-resolved semantics easy to miss | friction | open |
| 3 | New-generator authoring lacks an end-to-end recipe | friction | open |
| 4 | Row-context pattern for host-page row options | win | open |
| 5 | Cross-gen via `insertOperation` bypasses skip; replicate-and-import doesn't | win | open |

---

### 1. Spurious "bundle.js wasn't written" error from `skmtc bundle` [friction]

Encountered repeatedly throughout the session — every `skmtc bundle
mobile-app --json` call ended with a non-zero exit and the message
`Error: bundle.js was expected at <path> but wasn't written`, while
`bundle.js` was in fact freshly written and the subsequent `skmtc
generate` ran cleanly against it.

**What happened:** The bundle command's last log line in
`error-logs.txt` shows successful compilation:

```
Bundled 587 modules in 187ms
  bundle.js  817.73KB
⚠️  deno bundle is experimental and subject to changes
```

…immediately followed by `Error: bundle.js was expected at
file:///<...>/bundle.js but wasn't written` from the CLI's own
post-check. The file exists with current mtime; generate works.

**What was expected:** Either `bundle` succeeds with exit 0, or it
fails with exit non-zero AND the file isn't there. Not both.

**Why it matters:** Tooling that pipes `skmtc bundle` into a build
pipeline (CI, `pnpm full-service`, the `dev` watcher's rebundle) will
fail-stop on this. I had to manually verify the file was current after
every bundle. Multiple cycles spent ignoring the error and moving on.

**Possible fixes:** unresolved — likely a race or stale-check in
`bundleHeadless`. The post-check might run before Deno's file write
flushes, or the path comparison might be sensitive to symlinks.
Worth a `skmtc-debug` skill entry until root-caused.

**Version anchor:** `@skmtc/cli@<current>`, `@skmtc/core@0.5.1`,
`@skmtc/worker@0.2.6`. Reproducible with the project's current
`.skmtc/mobile-app/` workspace.

**Status:** open

---

### 2. `insertNormalizedModel` ref-vs-resolved semantics easy to miss [friction]

Authoring `ShadcnTable.constructor` — needed the items DTO type name
to emit `props: { getRowHref: (item: <ItemType>) => string }` in the
table's signature.

**What happened:** First implementation:

```ts
const toItemsSchema = (operation: OasOperation): OasSchema => {
  // ...
  return items.items.resolve()  // ❌ resolved early
}

this.itemTypeName = this.insertNormalizedModel(TsProjection, {
  schema: toItemsSchema(operation),
  fallbackName: `${settings.identifier.name}Item`
}).identifier.name
```

Output: the generated table file inlined `export type QuotesTableItem
= { id: string, tenantId: string, ... }` — duplicating the inline
shape into a new generator-local Definition.

The fix: drop the `.resolve()`. With the unresolved `OasRef`,
`insertNormalizedModel` reuses the existing `QuotingQuoteListItemDto`
Definition from `gen-typescript`'s normal model emission, and emits
`import { type QuotingQuoteListItemDto } from
'@/lib/api/generated/types/quotingQuoteListItemDto.generated.ts'`.

**What was expected:** that `insertNormalizedModel` would always
deduplicate by `(name, exportPath)` regardless of whether the schema
was a ref or a resolved object. Resolved schemas don't carry their
$ref name forward into the cache key, so the Driver can't recognise
the existing Definition.

**Why it matters:** Silent type duplication. Output compiles fine —
the duplicate is structurally identical — but every consumer of the
table file ends up with a `QuotesTableItem` type that's incompatible
(by name) with the canonical `QuotingQuoteListItemDto` everywhere else
in the codebase. Caused real friction when I extracted `QuoteRow.tsx`
and tried to import a shared item type.

**Possible fixes:**
- Generator skill §3.5: add a "pass unresolved ref" admonition — the
  current text mentions the helper but doesn't make this boundary
  explicit.
- `insertNormalizedModel` could try to detect the resolved-schema-
  that-was-a-ref case (the resolved schema's source ref name is
  available somewhere?) and reuse the named Definition. Probably
  fragile.
- Type signature: tighten `insertNormalizedModel`'s `schema` parameter
  so it accepts only `OasRef<'schema'>` (not the resolved schema) for
  the "reuse named ref" path, and a separate signature/method for
  inline schemas with fallback name.

**Version anchor:** `@skmtc/core@0.5.1`, observed in `@fieldplan/gen-shadcn-table@0.0.1`
during authoring.

**Status:** open

---

### 3. New-generator authoring lacks an end-to-end recipe [friction]

Authoring `@fieldplan/gen-shadcn-table` from a blank directory took
~15 minutes of "look at `gen-shadcn-form` and copy the structure"
before any code was written. Not blocking, but real cost spread across
many files.

**What happened:** The generator skill (§10) has task cards for:
- Cloning a stock generator (`skmtc clone`)
- Adding a field type
- Swapping a peer dependency
- Adding enrichment options
- Composing with another generator

…but no "Author a new generator from scratch in a consumer project's
`.skmtc/<project>/`" card. The closest is "Authoring a new generator"
which says "`skmtc create <project> <gen-name> operation`" — but
[`2026-05-16-selector-generator-poc.md`](./2026-05-16-selector-generator-poc.md)
K1 documents that `skmtc create` requires TTY (no `--json`, no
non-interactive scaffold), and the resulting layout isn't what the
form-generator template uses anyway.

The pieces I had to derive by analogy:
- Package root layout (`deno.json` + `mod.ts` re-export + `src/*.ts`)
- Workspace registration in 3 places (see K1)
- The `base.ts` / `mod.ts` / `<Main>.ts` / `enrichments.ts` split
- That `mod.ts` at the root re-exports `default` from `src/mod.ts`,
  not `src/mod.ts` being the package's exports directly

**What was expected:** a recipe somewhere that walks through "I have
a `.skmtc/<project>/` with stock generators installed. I want to add
a brand-new generator `gen-<name>`. Walk me through every file."

**Why it matters:** The form-generator scaffold is the canonical
reference, but it's also 18 files of optional complexity (Gates,
Snippets, projection-bases, layout helpers). A minimal "your table
generator only needs 4 files in src/" recipe would compress the
ramp-up significantly.

**Possible fixes:**
- A new task card in the generator skill §10: "Author a new generator
  from scratch in a consumer project."
- Alternative: a minimal-skeleton template stored in
  `skmtc-generators/_template/` that `skmtc create --json` could
  scaffold from.
- Cross-link from the cli skill: `skmtc create` → "if `--json` is
  needed, manually scaffold via this recipe."

**Version anchor:** `@skmtc/cli@<current>`, `@skmtc/core@0.5.1`,
observed during `gen-shadcn-table` authoring.

**Status:** open

---

### 4. Row-context pattern for host-page row options [win]

When the generator produces a list-row table, individual rows often
need flags that vary by host page (e.g. `hideCustomerColumn` on a
customer-scoped vs global jobs/invoices list). Threading those flags
through the generator means either:

1. Hardcoding the flag set in the enrichment shape (couples generator
   to specific consumer concerns).
2. Adding a generic `rowProps?: Record<string, unknown>` pass-through
   on the generated table (loses type safety at the boundary).
3. **(adopted)** Having the wrapper page provide a React context that
   the handwritten row reads via `useContext`. The generator is
   completely unaware; the row + wrapper are typed-together via the
   row's options-context module.

The pattern as shipped:

```tsx
// JobRow.tsx
const JobRowOptionsContext = createContext<{ hideCustomerColumn?: boolean }>({})
export const JobRowProvider = JobRowOptionsContext.Provider

export const JobRow = ({ job, onClick }: JobRowProps) => {
  const { hideCustomerColumn = false } = useContext(JobRowOptionsContext)
  // ...
}

// JobsTable.tsx (wrapper around GeneratedJobsTable)
export const JobsTable = ({ restrictions, hideCustomerColumn = false }) => (
  <JobRowProvider value={{ hideCustomerColumn }}>
    <GeneratedJobsTable
      restrictions={restrictions}
      getRowHref={(job) => `/jobs/${job.id}`}
      // ... no row-option props here
    />
  </JobRowProvider>
)
```

**Why it matters:** This boundary keeps the generator's emitted code
narrow (it doesn't know about, and doesn't care about,
`hideCustomerColumn` or any other host-specific row flag). The
wrapper-row contract is fully typed and fully owned by the consumer
project. Three different domains (`JobRow`, `InvoiceRow`, `LocationRow`)
each get their own typed context with their own option shape, and the
generator's signature is identical across all three.

**Why log as a win:** The "default suggestion" path is to extend the
generator's prop surface every time a row needs another flag — eroding
the consumer/generator boundary and growing the enrichment shape. The
context-based path is non-obvious (React-context-for-flags-not-
data is sometimes considered an anti-pattern in app code) but in a
generator/consumer architecture it's exactly right: the *generator's
output* is the cross-cutting boundary; data inside the application
(option flags from a host page) doesn't need to traverse it.

**Possible codification:** add a row to the generator skill §11
("Customization seams in stock generators") or as its own how-to:
"How to thread host-page-specific row options into a generated table."

**Version anchor:** `@skmtc/core@0.5.1`, `@fieldplan/gen-shadcn-table@0.0.1`,
applied across `JobRow`, `InvoiceRow`, `LocationRow` wrappers in the
mobile-app consumer.

**Status:** open

---

### 5. Cross-gen via `insertOperation` bypasses skip; replicate-and-import doesn't [win]

A generator authoring a consumer of a peer generator's emission has
two cross-gen styles, with **different skip-list semantics**:

**Style A — Cross-gen via the peer's Projection class:**

```ts
import { TanstackQuery } from '@skmtc/gen-tanstack-query-fieldplan'

// inside the Projection's constructor:
const hookName = this.insertOperation(TanstackQuery, operation).toName()
this.register({ /* …imports auto-registered by the Driver… */ })
```

The Driver materialises the peer's Definition (`useUpdateQuote`) at the
peer's canonical export path, registers an import into this Projection's
output file, and returns a handle. **Bypasses the peer's skip list** —
the memoization cache lives upstream of the Entry's `transform`-dispatch
filter, so skip never sees the cross-gen call.

**Style B — Replicate the peer's naming, emit a string import:**

```ts
const toHookName = (operation: OasOperation): string => {
  // …replicate gen-tanstack-query-fieldplan's toFieldplanHookName…
}

const hookName = toHookName(operation)
const hookImportPath = toHookImportPath(operation, hookName)
this.register({ imports: { [hookImportPath]: [hookName] } })
```

No `insertOperation` against the peer Projection → no cross-gen → no
materialisation. The emitted import is a literal path; if the peer
generator hasn't emitted the file (because the peer's skip list
includes the path), the consumer's typecheck fails with `Cannot find
module '@/lib/api/generated/services/.../use<Foo>.generated'`.

**Why log as a win:** This rule wasn't visible before today. Today's
two parallel POCs ([`@fieldplan/gen-shadcn-table`](./2026-05-16-table-generator-poc.md) and
[`gen-shadcn-selector`](./2026-05-16-selector-generator-poc.md)) hit
opposite consequences of the same rule. The choice between Style A
and Style B is a real architectural decision with operational
consequences:

| | Style A (`insertOperation`) | Style B (replicate naming) |
|---|---|---|
| Coupling | Hard dependency on peer Projection's exported class | Loose coupling — peer can be swapped/upgraded independently if naming stable |
| Skip list | Bypassed — generation is self-sufficient | Honored — consumer must keep peer enabled |
| Refactor blast radius | Peer's Projection signature change breaks every dependent | Peer's path/name change breaks every dependent (later — at consumer typecheck) |
| Drift detection | Compile-time at generator-bundle time | Runtime at consumer-typecheck time |
| Discoverability | The dependency is named in the source | Hidden behind a heuristic |

**Why this is a win, not a friction:** the rule is consistent and
architecturally clean once you know it. The two styles have
legitimate use cases — Style A for tightly-coupled "this generator
needs the peer's emission as a dependency"; Style B for "this
generator names a convention the consumer has independently chosen
to follow." Each generator author makes this choice consciously, but
nothing in current docs lays out the trade-off.

**Possible codification:** generator skill §3 ("cross-generator
coordination") currently describes the memoization cache and the
`insertOperation` helper. Add a paragraph laying out the
Style A vs Style B trade-off table (or similar). The skip-bypass
property is the most operationally consequential bit and should be
explicit: "`insertOperation` materialises the peer's emission
regardless of the peer's `client.json` skip/include config; emitting
a string import does not."

**Version anchor:** `@skmtc/core@0.5.1`,
`@skmtc/gen-shadcn-form@0.0.1`, `@skmtc/gen-shadcn-selector@0.0.1`
(local clone), `@fieldplan/gen-shadcn-table@0.0.1`.

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #5 — Cross-gen styles A vs B (skip-bypass property) | The cornerstone decision for any new generator that depends on a peer's emission. Today's two POCs observed both sides of this rule from opposite directions before reconciling. Once codified, all future generator authors decide with the trade-off in view. | Generator skill §3 — add a paragraph (or sub-section) on `insertOperation` vs replicate-and-import, with the trade-off table from entry #5. |
| 2 | #2 — `insertNormalizedModel` ref-vs-resolved semantics | Silent type duplication when authors over-resolve. One-line fix in the skill, or a tighter signature in `@skmtc/core`. | Generator skill §3.5 one-liner (small) OR `@skmtc/core` signature tightening (bigger). |
| 3 | #4 — Row-context pattern | Generalises beyond tables — any generated component whose handwritten leaves take host-specific flags. Currently lives in three identical implementations in this project; codifying once would prevent re-derivation. | New how-to in the generator skill, or a paragraph in §11. |
