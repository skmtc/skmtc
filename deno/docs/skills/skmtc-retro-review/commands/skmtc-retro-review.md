---
description: Aggregate SKMTC friction log entries into a review — cluster patterns, classify interventions, calculate convergence metrics, produce an action plan
argument-hint: "[period]"
---

Run a SKMTC friction log review.

**If `$ARGUMENTS` is non-empty**, use it as the period description.
Accepted forms:
- `2026-05` — a specific month
- `2026-Q2` — a quarter
- `pre-v0.6` — a named milestone
- `2026-05-01-to-05-14` — an explicit date range
- `since-last-review` — all session files created after the most recent
  file in `friction-log/reviews/`

**If `$ARGUMENTS` is empty**, default to the current calendar month.

Then follow the standard review flow (full details in the
`skmtc-retro-review` skill's `SKILL.md`):

1. **Locate the friction-log directory.** Walk up from CWD looking for
   `skmtc/deno/docs/friction-log/`. If not found, ask — do not
   silently default.

2. **Check for a prior review file** in `friction-log/reviews/`:
   - If one exists: read its action plan items and metrics history row
     to prepare the prior-action follow-up section.
   - If none: note that this is the first review.

3. **Glob and filter session files** for the period. Always include
   files with open entries regardless of date (carried-forward
   friction). Exclude `README.md`, `CLAUDE.md`,
   `discrepancy-catalog.md`, and anything in `reviews/`.

4. **Extract structured data** from each file's `## Index` table
   (severities, statuses) and `## Knowledge acquired` table if present.
   Read entry bodies only for entries you intend to cluster.

5. **Check prior action items** — for each P1/P2/P3 from the last
   review: verify whether the recommended change was made (read the
   target file or grep), and whether the friction pattern recurred in
   sessions after the change.

6. **Cluster** open entries by root cause (not surface topic). State
   each clustering hypothesis explicitly. Use the intervention decision
   tree (tooling > skmtc-code > skmtc-core-feature > skill-update >
   doc-update > agent-context > example-addition > removal) to classify
   each cluster.

7. **Calculate convergence metrics:**
   - FRR = recurrent entries / total entries
   - Blocker% = blocker entries / total entries
   - Total open entries (all time)
   - Knowledge backlog = `## Knowledge acquired` items not yet in docs/skills
   - Resolution velocity = avg days from creation to resolved (for
     entries resolved this period)

8. **Write the review file** to `friction-log/reviews/` named
   `<YYYY-MM-DD>-review-<period>.md`. Include in order: summary
   metrics table → convergence signal → prior action follow-up →
   cluster table → action plan (most specific action first, with
   falsifiable success criteria) → knowledge backlog → metrics history
   (append one row).

9. **Summarise to the user** in one short message:
   `Review written to <filename>. N clusters, top intervention: <P1 label — cluster name>. FRR: X% (prior: Y%). <1-sentence convergence signal>.`

**Action plan specificity requirement:** every recommended action must
name the exact file/section to change and the exact content to add —
not "improve documentation of X" but the precise paragraph or
principle. Each item needs a falsifiable success criterion and a
verification method (what to check in next retro files).

If the session files contain no open entries beyond what prior reviews
have already addressed, **say so explicitly** rather than fabricating
clusters. An empty review is better than false signal.

For full conventions, clustering rules, intervention taxonomy,
convergence metric definitions, and worked examples, defer to the
`skmtc-retro-review` skill's `SKILL.md`.
