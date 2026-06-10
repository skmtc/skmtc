# 2026-05-15 — Note-component pattern spike (Tier D dissolution)

Late-session spike to design a "note-component pattern" for the 6
Tier-D-deferred candidates (`InvoiceNotes`, `QuoteNotes`,
`QuoteInternalNotes`, `InvoiceInternalNotes`, `InvoicePaymentTerms`,
plus `QuoteInput` / `JobInput` compose boxes). Outcome: Tier D
dissolved on inspection — the 6 files are three distinct shapes, none
of which is a useful migration target.

## Knowledge acquired

Reading hand-coded note/comment surfaces in the consumer app to
decide whether to design a new generator-feature pattern.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | The 4 `*Notes` files (`QuoteNotes`, `QuoteInternalNotes`, `InvoiceNotes`, `InvoiceInternalNotes`) do **not** use `NoteComponent` despite the original codebase notes claiming so. They use `CommentCard` (`src/components/note-editor/CommentCard.tsx`). Surface similarity (filename, domain concept) was conflated with structural similarity. | Migration-planning methodology: notes-file claims about shared substrates must be ground-truth-checked. Worth a one-liner in the skmtc-cli skill's planning section, or in the consumer's own patterns doc. |
| K2 | Migration ROI heuristic: when planning a hand-coded → generated migration, the question isn't "is there a form-shaped surface?" but "what fraction of the file's LOC is the submit-handler vs surrounding UX?" `JobInput` is 222 lines, of which ~10 are the POST-comment call; the rest is drawer chrome + file-upload picker + customer/internal toggle + tooltips. Migrating only the submit-handler adds a generated file without meaningfully reducing the hand-coded LOC. | Worth codifying in `skmtc-cli` skill §"when to migrate" or a migration-playbook doc. Heuristic: "if surrounding UX exceeds ~30% of the file's LOC and isn't itself migrable, the migration is probably a net loss." |
| K3 | `CommentCard` (per-row inline-edit card) is structurally incompatible with `gen-shadcn-form`'s submit-button-form shape. The card has its own internal edit-lifecycle (Edit/Delete dropdown → inline Textarea → Save/Cancel) and is mounted as a list item. A skmtc-generated form would mount as a separate page, which doesn't fit the list-row UX. | This is an instance of a broader category — "inline-edit substrates" — that skmtc's current emitter shape can't serve cleanly. Worth a brief mention in skmtc-generator skill §boundaries: "inline-edit cards/rows that have their own lifecycle aren't a form-generator target; they belong with their own substrate component." |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Notes-file claim about shared substrate was based on filename, not implementation | friction | resolved 2026-05-15 (Tier D dissolved in notes file) |
| 2 | Form-generator emission shape doesn't cover inline-edit-card substrates | friction | open |

---

### 1. Notes-file claim about shared substrate was based on filename, not implementation [friction]

Earlier in this session I (the previous turn-self) wrote in the
codebase's `notes/form-migration-candidates.md`:

> "Most are `NoteComponent`-based inline editors (the same shape as
> `InvoicePaymentTerms`). Worth designing a dedicated note-component
> pattern once we have 3+ cases pinned down."

On reading the files this turn, this claim is incorrect. The 4
`*Notes` files use `CommentCard`, not `NoteComponent`. Only
`InvoicePaymentTerms` uses `NoteComponent`. The "Tier D" grouping
conflated three different substrates (`NoteComponent` / `CommentCard`
/ drawer compose box) under one umbrella because their filenames all
involve "notes" or "comments."

**What happened:** Spent ~30 minutes on a design spike that would
have produced a non-existent "note-component pattern" generator
feature, when the actual finding was that no shared pattern exists
across the candidates and all are legitimately hand-coded.

**What was expected:** That the codebase's own notes file was a
reliable basis for design decisions. It wasn't — it was based on
surface similarity rather than verified structural similarity.

**Why it matters:** Future agents reading the notes file would
inherit the same misclassification. Worse, this is recursive — *I*
wrote that section earlier in this same session without verifying.
Methodology: notes-file claims grouping candidates by shared
substrate must be ground-truth-checked (read each file, identify the
actual substrate component) before they're treated as design
foundations.

**Possible fixes:**
- Notes file updated this turn to dissolve Tier D and call out the
  three distinct shapes explicitly.
- Methodology lesson worth capturing as guidance for migration-tier
  authoring: "verify substrate via grep/read before grouping."

**Version anchor:** Consumer notes file at
`mobile-app/notes/form-migration-candidates.md` (pre-2026-05-15).

**Status:** resolved 2026-05-15 (notes file rewritten to reflect
three sub-shapes; Tier D removed from recommended-order list)

---

### 2. Form-generator emission shape doesn't cover inline-edit-card substrates [friction]

`gen-shadcn-form` emits forms shaped as "FormProvider wrapper +
FormBody (rows of fields) + FooterActions (Cancel + Submit)." This
shape fits page-level edit screens cleanly but doesn't fit inline-
edit cards like `CommentCard`, which has its own internal edit
lifecycle (Edit/Delete dropdown → inline Textarea → Save/Cancel)
mounted as a list row.

**What happened:** Considered generating a `<EditQuoteCommentForm>`
to migrate the 4 `*Notes` files. The generated form would mount as
its own thing inside the card — but the card already handles its own
Save/Cancel state and Textarea rendering. The generated form would
either (a) be unused (CommentCard's UX bypasses it), or (b) replace
CommentCard entirely (massive UX change, not a migration). Neither
useful.

**What was expected:** That the form generator's output could be a
drop-in for "any place that has an edit-a-string mutation handler."
It can't — the shape mismatch is structural, not configurational.
The generator's `submitLabel` / `onCancel` props are for full-form
submit UX, not inline-card lifecycle.

**Why it matters:** Inline-edit cards/rows are common in list views
(comments, audit-log entries, blocked-time entries, etc.). The form
generator's current emission shape is page-form-shaped; recognising
the boundary explicitly avoids design spikes that produce no useful
output. There's a real generator-feature gap here, but it's not a
"note-component pattern" — it's "generator emits an inline-edit
slot-component rather than a full FormProvider+Footer page form."
Whether that's worth building depends on how often the inline-card
pattern recurs.

**Possible fixes:**
- Skill-level: skmtc-generator §boundaries should call out "inline-
  edit cards/rows that own their own lifecycle aren't a form-
  generator target — leave them with their own substrate component."
- Generator-feature level: a separate generator that emits "inline-
  edit row components consuming a `lens` + a mutation hook" is a
  conceptually clean design, but the demand isn't proven (only 4
  candidates today, and they're already minimum-sized hand-coded
  wrappers around `CommentCard`).
- Pragmatic: accept the gap; don't invent the feature without
  multiple unmet uses.

**Version anchor:** `@skmtc/gen-shadcn-form` (cloned, post-variants,
post-CancelButton-gate-removal from `2026-05-15-wizard-standalone-cleanup.md` #2).

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | K2 — Migration ROI heuristic | The form generator's value-add depends on the ratio of submit-handler LOC to surrounding-UX LOC. Without this heuristic, agents will reflexively try to migrate any file containing a `mutateAsync` call and produce noise. | `skmtc-cli` skill §"when to migrate" — add a one-paragraph heuristic with the JobInput counterexample. Or in a separate migration-playbook doc. |
| 2 | #1 — Verify substrate before grouping | The "Tier D" misclassification cost ~30 min this session and could have cost more if acted on without verification. Future tier authors (whether agents or humans) need a guardrail. | Brief note in the skmtc-retro skill's "what NOT to log" or the skmtc-cli skill's planning section: "when grouping files into a migration tier, verify shared substrate by reading each file's top-level component, not just filename." |
| 3 | #2 — Inline-edit-card boundary | Recognising the structural boundary saves design-spike time. The 4 `*Notes` files + `CommentCard` are a pattern that recurs (audit logs, blocked times, attachments — anywhere with per-row inline edit). | skmtc-generator skill §boundaries — one sentence: "inline-edit cards/rows that own their own lifecycle aren't a form-generator target." Reference this entry. |
