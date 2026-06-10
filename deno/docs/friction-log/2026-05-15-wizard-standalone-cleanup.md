# 2026-05-15 — Wizard symmetry + standalone-edit cleanup

Continuation session: closed the wizard nested-create asymmetry
between jobs and quotes (job customer + both wizards' location), then
followed the same architecture through to standalone-edit detail-
section pages. Generator template edit eliminates `onCancel`
plumbing entirely for forms mounted inside a Container. Net result:
`?returnTo` / `?selectFoo` protocol is dead in jobs and quotes
contexts (invoice flow still uses it; deferred).

## Knowledge acquired

Operating across generator template edits, the cloned-generator
rebundle pipeline, and consumer-side Container/picker conventions.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `CancelButton` (in `@/components/wizard/CancelButton.tsx`) already reads `useContainerBack()` and falls through to `useBackOrFallback()` outside a Container. The chain is `explicit onCancel ?? containerBack ?? standaloneFallback`. So no consumer-side hook wiring is needed for "Cancel = go back where the Container's back chevron would go" — it's automatic. | The Container/CancelButton context wiring is non-obvious; worth mentioning in a `consumer-patterns` doc. The generator skill's `bodyWrapper` examples should reference this when discussing Cancel behaviour. |
| K2 | `gen-shadcn-form`'s `ShadcnFormFooter.toString()` gated `<CancelButton>` rendering behind `{props.onCancel && ...}`. That gate **defeats** K1: even though `CancelButton` has Container-context fallbacks, the form never rendered it unless an explicit prop was passed. Removing the gate (one-line template edit) lets the consumer-side fallback chain do its job. | Cloned-generator gotcha. Worth a section in the generator skill: "if you're consuming a component with internal context fallbacks, don't gate its rendering on the explicit-prop being passed — that bypasses the fallback." |
| K3 | The `Form-wrapper-file + Page-file` split (per the precedent in `QuotesCustomerCreateForm.tsx`) is purely organisational — it has no testing, preview, or reuse benefit when the form is mounted at exactly one route. The "smart page, no wrapper" alternative is ~50 LOC of inline JSX vs ~64 LOC across two files. Net: one file, less indirection, same testability. | Consumer pattern decision: should be documented as "prefer inline form mount in the page" for single-route create pages. The split adds files without value. |
| K4 | `pnpm skmtc bundle <project>` silently fails with `Error: bundle.js was expected at ... but wasn't written`, while `deno bundle --output=/tmp/out.js .skmtc/<project>/worker.ts` succeeds against the *same* worker.ts (bundles ~580 modules, ~800KB output). The CLI's `bundleHeadless` is doing something different from a direct deno bundle. Workaround: `deno bundle` directly + `cp` to expected location. | **Real CLI bug** in `@skmtc/cli`. The `bundleHeadless` helper is wrapping deno's bundle but failing in a way that doesn't surface the underlying error. Worth a SKMTC-side issue + diagnostic improvement (capture and re-throw the underlying error). |
| K5 | The picker round-trip protocol (`returnTo` + `?selectFoo=<newId>` auto-confirm) exists at three layers: (a) the picker host passes `returnTo={pathname}` and reads `selectFoo` on remount, (b) the create page reads `?returnTo=` and appends `?selectFoo`, (c) every consumer threads the URL correctly. With generated forms, **per-context nested create pages with explicit navigation are cheaper than the protocol** — each new page is ~30-40 LOC, the protocol has ~80 LOC across components plus mental overhead in every caller. The economics flipped when forms became generated. | Concept doc: "page-owned navigation vs. URL-protocol roundtrip — when each pattern wins." The crossover point is when forms become trivially reusable. |
| K6 | `LocationSelectSection`'s comment says "locations belong to customers, not to the parent record, so the create form lives at the customer's URL." That's a data-architecture claim conflated with a URL-architecture claim. The data relationship (location has customerId FK) is preserved by passing `customerId` to `CreateLocationForm`; it does NOT require the create form to live at `/customers/:customerId/locations/new`. Once the form is reusable, each consumer can host its own create page with whatever URL the consumer's flow needs. | The conflation is the architectural source of the round-trip protocol. Worth surfacing in a design-note: "data-relationship is not URL-hierarchy." |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `skmtc bundle` silently fails when `deno bundle` succeeds standalone | blocker | open |
| 2 | Generator template gate on `onCancel` bypasses Container-context fallback | friction | resolved 2026-05-15 (template edited in cloned `gen-shadcn-form`) |
| 3 | Form-wrapper-file convention duplicates effort with no payoff | polish | resolved 2026-05-15 (4 wrappers inlined into pages) |
| 4 | Page-level nested-create eliminates `returnTo` + `selectFoo` protocol | win | open |

---

### 1. `skmtc bundle` silently fails when `deno bundle` succeeds standalone [blocker]

After editing `gen-shadcn-form/src/ShadcnFormFooter.ts`, ran `pnpm
skmtc bundle mobile-app`. The CLI failed with:

```
Error: Uncaught (in promise) Error: bundle.js was expected at
file:///.../.skmtc/mobile-app/bundle.js but wasn't written
    at bundleHeadless (...cli/lib/bundle-headless.ts:70:11)
```

No underlying compilation error surfaced — `bundleHeadless` saw no
output file and threw. Running `deno bundle --output=/tmp/test.js
.skmtc/mobile-app/worker.ts` directly succeeded: "Bundled 580 modules
in 102ms" with an 804KB bundle, including the new template content.

**What happened:** Manual workaround was `deno bundle` + `cp` the
output to `.skmtc/<project>/bundle.js`. After that, `skmtc generate`
correctly picked up the new bundle and emitted the new template.

**What was expected:** Either the CLI's `bundleHeadless` works (using
the same deno underneath), or it surfaces the underlying error so the
user can diagnose. Silent-no-output-thrown is the worst diagnostic.

**Why it matters:** Generator template edits are the canonical
customization seam. If rebundling silently fails, the iteration loop
breaks: edit template → bundle (silently fails) → generate (uses
stale bundle) → wonder why nothing changed → eventually trace it
back. Cost a chunk of session time today; will cost others'.

**Possible fixes:**
- Capture `deno bundle`'s stdout/stderr in `bundleHeadless` and
  include it in the thrown error when bundle.js is missing.
- Investigate why the wrapper-invoked deno produces no output where
  the direct invocation does (env? cwd? perms?).
- Document the deno-bundle-direct workaround in the CLI skill as a
  temporary recipe.

**Version anchor:** `@skmtc/cli@<current shim>`, `@skmtc/core@0.5.1`,
deno 2.x.

**Status:** open

---

### 2. Generator template gate on `onCancel` bypasses Container-context fallback [friction]

`ShadcnFormFooter.toString()` rendered:

```tsx
{props.onCancel && <CancelButton onCancel={props.onCancel} disabled={isSaving} />}
```

`CancelButton` itself already chains `props.onCancel ?? containerBack
?? standaloneFallback`, so it'd work fine even without an explicit
prop. The gate prevents the Cancel button from ever rendering unless
the prop is passed, defeating the fallback chain. Every consumer
(wizard, standalone-edit, anything inside a Container) had to pass
an explicit `onCancel` that did the same thing the Container's
`onBack` would do anyway.

**What happened:** Edited the template to render `<CancelButton>`
unconditionally. Now consumers inside a Container omit `onCancel`
entirely; the button picks up Container context. Dialog-mounted
forms (RecordPaymentDialog, etc.) continue passing explicit
`onCancel={() => onOpenChange(false)}` — the explicit prop still
wins, so dialog behaviour is unchanged.

**What was expected:** That a component with internal context
fallbacks would be allowed to use them — i.e., that the generator's
template wouldn't gate rendering on the explicit prop.

**Why it matters:** Across all migrated forms, the explicit
`onCancel={() => navigate(<same place container onBack goes>)}` was
boilerplate duplication. Removing the gate dropped ~10 lines of
redundant code across the wizard + standalone-edit pages we shipped
this session; will drop similar lines from future migrations.

**Possible fixes:** Done. Template edit in cloned generator. Worth
upstreaming to `@skmtc/gen-shadcn-form` if the consumer-side
`CancelButton` pattern is broadly applicable.

**Version anchor:** Cloned `@skmtc/gen-shadcn-form` (post-variants).

**Status:** resolved 2026-05-15 (template edit at
`.skmtc/mobile-app/gen-shadcn-form/src/ShadcnFormFooter.ts:37-41`)

---

### 3. Form-wrapper-file convention duplicates effort with no payoff [polish]

The precedent for nested-create pages (`QuotesCustomerCreateForm.tsx`
+ `QuotesCustomerCreateWizardPage.tsx`) splits the smart navigation
+ chaining logic into a separate "Form" file from the Page chrome.
We mirrored this for the new wizard work (`JobsCustomerCreateForm`
etc.), then questioned it: why the split?

**What happened:** On inspection, the Form wrapper:
- Has exactly one consumer (its sibling Page file)
- Has no preview/storybook tooling targeting it
- Has no test isolation benefit (rendering the Form vs the Page is
  equivalent for testing)
- Doesn't simplify hot reload (Vite recompiles either way)

We collapsed all 4 wizard Form wrappers into their Page files. Net:
~30 LOC saved across the four flows, one fewer file per flow, and
the route-to-behaviour mapping is colocated.

**What was expected:** That a Form/Page split would have load-bearing
benefit (preview tooling, multi-consumer reuse, test isolation). It
doesn't.

**Why it matters:** Two-file-per-flow conventions multiply: invoice
wizard might add 2-3 more nested-create flows, each adding 2 files
under the old pattern. Setting the right precedent (one file per
flow) compounds in savings.

**Possible fixes:** Done. 4 wrappers deleted, content inlined. Worth
documenting in the consumer's patterns directory: "prefer inline form
mount in the page for single-route create pages."

**Version anchor:** N/A (consumer convention).

**Status:** resolved 2026-05-15

---

### 4. Page-level nested-create eliminates `returnTo` + `selectFoo` protocol [win]

This session shipped 7 new nested-create pages (3 wizard + 4
standalone-edit) replacing the picker-round-trip protocol for every
non-invoice, non-customer-detail context in jobs and quotes. The
pattern is now well-trodden:

- Picker host passes `onAddCustomer` / `onAddLocation` (the existing
  prop on `CustomerSelectSection`; the new prop we added to
  `LocationSelectSection`) — navigates to a context-specific create
  route
- That route mounts a Page that wraps the generated form (no
  separate Form wrapper file) and bakes in the post-save navigation
  + the right `updateJob` / `updateQuote` mutation
- The form's `<CancelButton>` auto-picks up Container's `onBack` (per
  entry #2)

No more `?returnTo` query param, no more `?selectFoo` auto-confirm
effect in `LocationSelectSection`, no more `useEffect` reading +
clearing a URL param to fire `onConfirm`.

**Why it matters:** This pattern is what every nested-create-from-
picker flow should look like. Before this session, the convention
was the URL protocol (load-bearing when forms were hand-coded). The
crossover point — where small wrappers beat the protocol — is when
the form becomes generated. Most flows in this codebase passed that
crossover but hadn't been refactored.

**The pattern's three pieces:**
1. **Picker `onAddX` prop** — the picker delegates "Add" navigation
   to the host
2. **Per-context Page that mounts the generated form** — bakes in
   the mutation + navigation
3. **Container-context onCancel** (per entry #2) — no redundant
   onCancel plumbing

Each per-context page is ~30-40 LOC. Across 7 pages this session
(wizard + standalone-edit, jobs + quotes), that's ~240 LOC of
explicit, testable, debuggable navigation logic replacing the
implicit URL-protocol behavior.

**Codification candidate:** consumer's patterns directory should have
a `nested-create.md` describing this pattern. Generator skill should
reference it from §customization-seams when discussing `bodyWrapper`
/ `defaultsHook` — those are tools for the form's content, this is
the tool for the form's surrounding flow.

**Version anchor:** Pattern established 2026-05-15 across:
- `JobsCustomerCreateWizardPage`, `JobsLocationCreateWizardPage`,
  `QuotesCustomerWizardPage` (nested page), `QuotesLocationCreateWizardPage`
- `JobCustomerCreatePage`, `JobLocationCreatePage`,
  `QuoteCustomerCreatePage`, `QuoteLocationCreatePage`

**Status:** open (pattern shipped; doc work pending)

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #1 — `skmtc bundle` silently fails | Breaks the canonical iteration loop for generator authoring. Anyone editing a cloned generator's template hits this; the workaround is non-obvious until you compare deno-direct vs CLI. | `@skmtc/cli` code fix: capture deno's stdout/stderr in `bundleHeadless` and include it in the thrown error. Until then, document the `deno bundle` + `cp` workaround in the `skmtc-cli` skill as a recipe. |
| 2 | #4 — Page-level nested-create pattern | The "right" pattern for nested-create-from-picker is now shipped 7×, but uncodified. Future migrations will reach for the URL-protocol pattern again unless this is documented. | Consumer-side `patterns/nested-create.md` capturing the three pieces (picker `onAddX` prop, per-context Page, Container-context onCancel). The generator skill should cross-link. |
| 3 | #2 — Generator template gate observation | Cloning patterns repeat. The `{props.onCancel && X}` gate is the kind of small choice that propagates from one generator template to the next. Worth a brief skill note: "don't gate rendering on the explicit prop being passed if the underlying component has internal context fallbacks." | Generator skill §anti-patterns: one paragraph + this example. |
