# 2026-05-18 — gen-shadcn-form `job-site` variant

Added a `job-site` variant to `POST /v2/customers/locations` for the
FieldPlan mobile app's quote-location-create flow. Trimmed the form
(no `type`, no contact name/phone), injected `type: "job_site"` via
synthesized literal, and routed `accessNotes` through a consumer-side
collapsible textarea component. Ran `skmtc generate mobile-app` to
produce `CreateLocationJobSiteForm.generated.tsx` and rewired the
two consuming pages.

## Knowledge acquired

gen-shadcn-form variant authoring + the cli surface around it.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `synthesized` accepts a third member shape `{ id, literal: <string\|number\|boolean> }` for hardcoded server-required values that the form never surfaces to the user. The skmtc-cli skill's "Configuring enrichments" card and the gen-shadcn-form reference only show `source` and `prop` in examples — `literal` is in the Valibot schema but not in any worked example. | Add a `literal`-variant worked example to `skmtc-cli` skill §"Configuring enrichments" and to the gen-shadcn-form reference. The canonical case is "API requires field X; UI always wants the same constant" — common enough to merit being shown alongside `source` / `prop`. |
| K2 | gen-shadcn-form does NOT use `withVariant` from core. Its `base.ts` defines an inline `toVariantSuffix` that **inserts** the PascalCased variant before the trailing `Form` suffix (`CreateLocationForm` + `job-site` → `CreateLocationJobSiteForm`), rather than the `withVariant` helper's documented append behaviour (which would give `CreateLocationFormJobSite`). Both yield distinct cache keys; the difference is purely aesthetic. | The skmtc-generator skill §"Authoring a variants-aware generator" (Card) presents `withVariant` as the canonical way to fold the variant into the name. Add a one-liner noting that some stock generators (gen-shadcn-form) implement the fold inline for naming-aesthetic reasons — `withVariant` is the helper, not a hard rule. |
| K3 | When a generator's output is in `src/components/forms/*.generated.tsx`, the generated identifier name follows the `toIdentifier` derivation deterministically — meaning you can predict the new file/name before running `skmtc generate`. Useful for prepping consumer-side edits (the page that switches to the new variant form) before the file exists on disk. | None — this matches the contract documented in skmtc-generator §"Cross-generator coordination". Worth keeping as a mental anchor for agents but not a doc change. |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `skmtc bundle <project> --json` errors with "bundle.js wasn't written" while `skmtc generate` succeeds and bundle.js is on disk | friction | open |
| 2 | Cannot annotate generated components with consumer-side JSDoc (e.g. `/** @pattern selector */`) — regeneration wipes any hand-added comment | friction | open |

---

### 1. `skmtc bundle <project> --json` errors with "bundle.js wasn't written" while `skmtc generate` succeeds and bundle.js is on disk [friction]

Mid-session, after editing `client.json` enrichments, I ran
`skmtc bundle mobile-app --json` defensively. It failed with a
`bundleHeadless` error claiming `bundle.js was expected at <path> but
wasn't written`.

**What happened:** The error fires from
`https://jsr.skmtc.dev/@skmtc/cli/0.2.6/lib/bundle-headless.ts:70`. At
the same time:

- `ls -la <bundle.js>` showed it existed (894KB, recent mtime).
- `skmtc generate mobile-app --json` ran successfully against it
  (0 errors, 0 parseIssues, all expected artifacts produced).
- `skmtc doctor --json` reported `project-bundle/mobile-app` as
  status `warning` with hint "Run `skmtc bundle mobile-app` to build
  it" — i.e. it claimed the bundle was missing even though it was
  present and functional.

Repro was deterministic — same error on second invocation, no
intermittency.

**What was expected:** `skmtc bundle` either succeeds (rewriting
bundle.js) or no-ops cleanly when there's nothing to rebundle. Either
should leave the doctor check in `ok` state given a working
`generate`.

**Why it matters:** Three signals contradict each other —
`generate` says "fine," `doctor` says "warning," `bundle` says
"error." For an agent following the skmtc-cli skill's
guidance ("Run `skmtc doctor --json` first; targeted fix beats
nuke-and-pave"), the doctor warning + bundle error would push them to
"fix" something that isn't broken. Worst case they delete bundle.js
to force a fresh one, then can't regenerate it because the same
error fires. The skill's mental model of bundle vs. generate
relies on these signals being consistent.

Workaround applied: trusted `generate`'s success, skipped the
bundle step entirely (no generator source changes in this session
meant no rebundle was required anyway, per skill §"Configuring
enrichments").

**Possible fixes:** Unresolved — needs investigation. Plausible
directions: the headless bundle path checks for a file
written-during-this-invocation rather than file-exists-on-disk, and
fails when the existing file is already current; or the doctor
check is racing with another process; or there's a path-resolution
mismatch where bundle and generate read from different locations.

**Version anchor:** `@skmtc/cli@0.2.6`, `@skmtc/core@0.5.1`,
`@skmtc/worker@0.2.6`. Project: `mobile-app` (FieldPlan, with cloned
`gen-shadcn-form`, `gen-shadcn-selector`, `gen-shadcn-table`,
`gen-tanstack-query-fieldplan`, `gen-fieldplan-filters`).

**Status:** open

---

### 2. Cannot annotate generated components with consumer-side JSDoc (e.g. `/** @pattern selector */`) — regeneration wipes any hand-added comment [friction]

Later in the session I was applying `/** @pattern selector */` JSDoc
annotations to canonical examples for a new pattern doc in
`mobile-app/patterns/selector.md`. The canonical selector files are
generated (`src/components/selectors/<Resource>Selector.generated.tsx`
from `@skmtc/gen-shadcn-selector`).

**What happened:** I wanted to put `@pattern selector` on
`CustomerSelector.generated.tsx` itself (the cleanest canonical
example), but adding it would be wiped on the next `skmtc generate`.
I ended up annotating the hand-written hosted shells
(`src/components/customer-picker/CustomerSelectorContent.tsx` and
`src/components/location-picker/LocationSelectorContent.tsx`) instead
— but those are only present for *some* selectors. A consumer that
uses a generated selector directly (no shell) has nowhere durable to
put the annotation.

**What was expected:** Some way to express "annotate the generated
component's exported symbol with this doc comment" via enrichments,
so the annotation round-trips through regeneration.

**Why it matters:** The consumer codebase has a working pattern-doc
system that uses JSDoc `@pattern` tags as a discovery + verification
mechanism (the `doc/patterns.md` system links each pattern to seed
files; annotations let tooling crosswalk both directions). Generated
files are second-class citizens in that system because they can't
carry the marker. The same friction applies to any consumer-side
convention that lives as a code comment — `@deprecated` flags,
team-specific doc-tooling tags, license headers.

The current workaround — annotate a hand-written wrapper — works
when one exists, but it pushes a structural decision (must this
component have a wrapper?) onto something orthogonal (do I want to
mark it with a pattern tag?).

**Possible fixes:** Unresolved — needs reflection. Off the top:

- An enrichment field on each operation/model that emits a leading
  doc comment before the main exported symbol (`docComment: '@pattern
  selector'` or richer).
- A separate side-file convention (`<File>.generated.meta.ts`) for
  consumer-owned metadata that survives regeneration.
- Treating this as out-of-scope for SKMTC and pushing consumer
  tooling to read pattern info from a separate registry rather than
  JSDoc on the generated file.

**Version anchor:** `@skmtc/gen-shadcn-selector` (mobile-app
clone, on `@skmtc/core@0.5.1`).

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | K1 — `synthesized.literal` shape is missing from worked examples | Most agents reaching for "hardcode an API-required body field" will not discover `literal` from the skmtc-cli skill alone; the schema is in Valibot but it doesn't surface in any example. Quick doc fix with high impact for any consumer that needs context-locked forms. | Add a `literal` example to skmtc-cli skill §"Configuring enrichments" and gen-shadcn-form reference. |
| 2 | #1 — `skmtc bundle` error vs. `generate` success contradicts doctor | Three signals disagree; the skmtc-cli skill instructs agents to "run doctor first," but doctor's warning here is a false positive that would mislead. Needs source-level investigation before being addressable in docs. | SKMTC code investigation (`@skmtc/cli@0.2.6` bundle/doctor logic), then either fix the contradiction or document the failure mode. |
| 3 | K2 — gen-shadcn-form uses inline variant-suffix logic, not `withVariant` | The skmtc-generator skill presents `withVariant` as the canonical pattern; agents authoring new variants-aware generators may follow the worked example mechanically and produce a different naming shape than gen-shadcn-form's. Worth a one-liner so the helper is understood as one option, not the only one. | Add note to skmtc-generator skill §"Authoring a variants-aware generator" Card. |
