# Docs remediation tracker

Living ledger for the docs-vs-source cleanup kicked off by the
[2026-07-07 audit](2026-07-07-docs-vs-source-audit.md). **Any session
can resume from this file.** Update it as work lands — tick items,
record PRs, note what's in flight.

Companion state that also survives across sessions:

- Raw audit findings: `2026-07-07-docs-vs-source-audit-findings.json`
  (195 discrepancies + 53 gaps from the partial run).
- Re-audit findings (the 90 unaudited pages):
  `docs-remediation-reaudit-findings.json` (written when that run
  completes; absent until then).
- Mechanical guards that prevent *new* drift: `docs/verify-docs.ts`
  (source↔doc sync checks) and `docs/doc-test.ts` (fenced-block
  compile), both wired into `deno task verify-docs`.

## How to work an item (the loop)

1. **Verify against source first** — do not trust an audit finding.
   The audit was wrong more than once (e.g. `insertOperation` is
   object-arg only on `context.`; the projection-base
   `this.insertOperation(proj, op)` is positional and correct). Read
   `core/` before editing.
2. **Fix tree-wide, not page-by-page** — grep the whole `docs/` tree
   for the bad pattern; systematic issues recur on pages the audit
   never listed.
3. **Gate**: `cd deno && deno task verify-docs` must stay green.
4. **One PR per cluster** (or per coherent batch); update this file
   with the PR number; commit the tracker change with the work.

## Systematic clusters (pre-0.8 API drift) — DONE

All six verified against source and fixed.

- [x] `acc`/`reduce` removed from `transform` — PR #45 (merged)
- [x] `insert*` arg shapes + return types — PR #47 (merged)
- [x] Enrichment three-scope umbrella model — PR #47 (merged)
- [x] Bundle behavior + `worker.ts` template — PR #48 (merged)
- [x] Attribution / gen-maps rewrite (+ architecture skill) — PR #48 (merged)

Lesson banked: the skills / `llms.md` / canonical concept pages were
already correct on clusters 1–3 (drift was in authoring
how-tos/tutorials/recipes); attribution was the exception (skill wrong
too).

## Re-audit of the 90 unaudited pages — IN PROGRESS

The original audit reached only 36 of 126 pages (credits ran out). An
**audit-only** re-run (no adversarial verify phase — findings are
verified by hand during triage) covers the rest. Page list:
`scratchpad/unaudited.json` at run time; the 90 are the complement of
the 36 in the original findings JSON.

- [ ] Re-audit run complete → findings in
      `docs-remediation-reaudit-findings.json`
- [ ] Re-audit findings triaged + fixed (verify-first, tree-wide)

Workflow resume: the audit workflow supports `resumeFromRunId`
(cached agents replay). Script + runId are recorded in the run's
tool result; if lost, re-run fresh over the pages still lacking a
result line in the run journal.

## Long tail from the original audit — NOT STARTED

- [ ] 113 lower-severity "misc" findings (per-item triage) —
      `2026-07-07-docs-vs-source-audit-findings.json`, `uncertain[]`
      minus the systematic clusters already fixed
- [ ] 53 gaps (per-item triage) — same file, `gaps[]`

Many of these are on pages the systematic tree-wide sweeps already
touched; re-verify each against current source before acting (some are
already resolved, some were audit false positives).

## Definition of done

The corpus is "done" for a pass when: every page has been audited once
against current source; every confirmed discrepancy is fixed or logged
here with a reason; `deno task verify-docs` is green; and the
mechanical guards cover the systematic patterns so they cannot silently
return.
