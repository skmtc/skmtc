# 2026-05-16 — Selector generator POC

Authored `gen-shadcn-selector` from scratch — a new generator that
emits picker/selector components for GET-list endpoints. Validated
against three real OAS shapes (paginated with filters, flat with
path param, paginated with single filter). Generated CustomerSelector
wired into `JobCustomersSection` end-to-end as validation. Surfaces
two real cross-generator coordination gaps.

## Knowledge acquired

Authoring a new operation-Entry generator from scratch, exercising
the operation-reference protocol implicitly (replicating peer-
generator naming) and `defineAndRegister` for sibling type aliases.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | **`skmtc create` requires TTY** — no `--json` flag, no scriptable scaffold. Manually scaffolded by copying `gen-shadcn-form`'s directory layout. Took ~10 minutes that `skmtc create` should have handled. | CLI gap: add a `--non-interactive` mode for `create` so agents can scaffold without interactive prompts. Or document the manual-scaffold recipe in the cli skill. |
| K2 | **`defineAndRegister` works cleanly for sibling type aliases** — registering an `Identifier.createType(...)` Definition lands as `export type ${name} = ${value}` in the same file as the main Projection's output. No separate Projection subclass needed for simple aliases. | Generator-authoring pattern worth a one-liner in the skmtc-generator skill: "for a type-alias sibling in the same file, `context.defineAndRegister({ identifier: Identifier.createType(name), value, destinationPath: settings.exportPath })` is the lightest path — no need to author a sibling Projection class." |
| K3 | **Response-shape detection via schema-walking is fragile** in this OAS — the Fieldplan envelope (`{success, data: T}`) plus `?.resolve()` semantics made walking past the wrapper unreliable in my POC. The robust heuristic that survived was: "endpoint accepts `pageSize` query param" ⇒ paginated response, otherwise flat. Held for every list endpoint inspected. | Worth a note in the skmtc-generator skill: "schema-walking past envelopes is brittle; convention-driven heuristics (presence of well-known query params, naming patterns) are often more robust until tested otherwise." |
| K4 | **Replicating a peer generator's identifier algorithm beats taking a runtime dependency** for POC scope. `gen-shadcn-selector` replicates `gen-tanstack-query-fieldplan`'s `toFieldplanHookName` to derive the query hook's name + import path. The duplication is intentional — the alternative (operation-reference protocol with the peer Projection imported) couples lifecycle to the peer's stability. For long-lived production, the operation-reference protocol is correct; for POC, replication is faster. | The generator skill's §3.5 (operation-reference protocol) should mention the replication-vs-protocol trade-off, and when each fits. |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Skip-list entries should still emit when another generator references them | friction | open |
| 2 | Enrichment design rewards re-reading the OAS rather than restating it | win | open |

---

### 1. Skip-list entries should still emit when another generator references them [friction]

Generating `TechnicianSelector` failed at typecheck with:

```
Cannot find module '@/lib/api/generated/services/resources/useTechnicians.generated'
or its corresponding type declarations.
```

**What happened:** Added `/v2/resources/technicians` GET to
`gen-shadcn-selector`'s enrichments + removed from its skip list.
The selector generated correctly. But `useTechnicians.generated.ts`
didn't exist — the endpoint was in `gen-tanstack-query-fieldplan`'s
skip list. The selector imports a hook that's not being generated.
Required a *paired* edit: remove from BOTH skip lists.

**What was expected:** The current model treats `skip` as a per-
generator allow/deny list, evaluated independently. The selector
generator's emission references a peer-generator artifact (the
query hook) — an implicit cross-generator dependency. Conceptually,
"don't generate the form for this endpoint" doesn't imply "don't
generate the hook for this endpoint" when another generator needs
the hook.

**Why it matters:** The exhaustive-skip pattern used in this
project (every endpoint opted out by default, opted in
selectively) compounds the problem. When the consumer wants to add
a selector, they must remember to ALSO enable the underlying hook.
The failure mode is silent at generation time (no error from the
selector generator — it just emits an import that doesn't resolve)
and only surfaces at consumer typecheck.

Worse, the `transform({ context, operation, ... })` callback in the
selector generator already calls `context.insertOperation` (or could
call `insertOperation` against the peer query-hook generator) — the
engine has the machinery to materialise the dependency. But the
skip-list filter is evaluated upstream of `transform`, so the peer
hook is silently dropped before the selector even runs.

**Possible fixes:**
- Engine-side: when `generator A` (under skip) is referenced as a
  cross-generator dependency by `generator B` (active), the skip is
  treated as advisory and the dependency is materialised. This
  requires `transform`-time dependency declaration to flow back into
  the filter evaluator.
- Manifest-side: emit a warning when a generated file imports a
  path that doesn't correspond to any file in `manifest.files` —
  surfaces the mismatch at generation time rather than at consumer
  typecheck.
- CLI doctor check: `dangling-imports/<project>` that compares
  emitted imports against generated artifacts and lists mismatches.
- Recipe-level: document the "paired enable" pattern in the cli
  skill so consumers know to check both skip lists when enabling a
  generator that depends on a hook.

**Version anchor:** `@skmtc/core@0.5.1`, `@skmtc/cli@<current>`,
exhaustive-skip pattern as configured in this project's
`client.json`.

**Status:** open

---

### 2. Enrichment design rewards re-reading the OAS rather than restating it [win]

The selector generator's v0 enrichment included `queryHook: {from, as}`,
`primaryFields: string[]`, `secondaryField: string`. When the user
pushed back on the design, the v1 collapse made the enrichment
purely presentation:

```typescript
// v0
{ queryHook: { from, as }, primaryFields: [...], secondaryField, ... }

// v1
{ primary: string | string[], secondary?: string, filters?: string[],
  title?, emptyMessage?, detailsButton? }
```

What moved from enrichment to OAS-reading:
- Hook identity (`queryHook`) → derived from operation via
  replicated `toFieldplanHookName` algorithm
- Path params → read via `operation.toParams(['path'])`, emitted as
  required props on the selector
- Query params + types (string vs enum vs integer) → read via
  `operation.toParams(['query'])` + classification, emitted as nuqs
  bindings only for filters the consumer opts into by name
- Response shape (paginated vs flat) → detected via `pageSize`-
  presence heuristic

**Why it matters:** Enrichment is for things the OAS can't express —
display copy, which fields to render as primary/secondary, which of
the OAS's available query params to surface as user-facing UI. The
moment enrichment starts restating OAS facts (which hook, what
filters exist, what types they are), the generator becomes a
templating engine rather than a code generator that *knows the API
shape*.

The friction in writing the v0 enrichment was real: every new
selector would need to declare 4-5 properties that the OAS already
spells out. The user's "have a think about how nuqs could help"
pointed at the right answer — query params from OAS, bound to nuqs,
typed-input UI from the param's own schema.

**Why log as a win rather than friction:** the pattern of "if you're
about to add an enrichment, first check whether the OAS already
says it" is a generally-applicable design heuristic for SKMTC
generator authoring. Worth codifying alongside the existing
operational principles in the skmtc-generator skill.

**Possible codification:** add a "enrichment vs OAS" principle to
the generator skill's operational principles table:
- Default suggestion: "let the consumer declare all dimensions in
  enrichment for maximum flexibility"
- SKMTC's stance: "read everything the OAS already says (params,
  types, response shape) directly from the operation; reserve
  enrichment for things only the consumer can know (which fields to
  render as primary, what 'open details' means, what to call the
  empty state)."

**Version anchor:** `@skmtc/core@0.5.1`, design observation from
authoring `gen-shadcn-selector` (local clone).

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — Skip-list vs cross-generator dependency | This silently produces broken output (import to non-existent file). Anyone authoring a new generator that depends on a peer's emission will hit this. The fix has multiple viable forms (engine override, doctor check, recipe doc) — pick one. | Either engine-side resolution (most powerful, biggest change), or `skmtc doctor` `dangling-imports` check (medium effort, catches the failure at generate-time rather than consumer-typecheck). At minimum, document the paired-enable recipe in the cli skill. |
| 2 | #2 — Enrichment vs OAS design heuristic | Generator authors will repeat the v0-style "redeclare everything in enrichment" mistake unless this is codified. The heuristic is universal across operation-Entry generators. | Add to skmtc-generator skill §operational-principles: "Default intuition → SKMTC's stance" row contrasting "user declares everything in enrichment" with "read everything from OAS, reserve enrichment for things only the consumer knows." |
