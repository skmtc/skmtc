# Friction log

Append-only log of friction encountered and wins observed during SKMTC
sessions. Reviewed daily; entries drive updates to skills, docs, and
occasionally SKMTC code itself.

## Directory layout

One file per session, named `<YYYY-MM-DD>-<short-summary>.md`. Each
file is self-contained — entries inside it are numbered starting at 1,
and cross-file references use `<filename>#<N>` format.

Examples of filenames:

- `2026-05-12-create-retro-skill.md`
- `2026-05-13-shadcn-form-clone.md`
- `2026-05-14-enrichment-design-spike.md`
- `2026-05-15-debug-empty-output.md`

ISO date prefix means directory listings sort chronologically. The
3-4 word summary captures what made each session distinct.

## What goes here

- **Friction:** APIs that surprised, defaults that needed overriding,
  patterns that took multiple cycles, error messages that were
  unhelpful, invariants that were almost violated.
- **Wins:** patterns that felt natural, architecture that saved work,
  generators that were good starting points, type-system catches that
  prevented bugs.

Both kinds carry equal weight — wins identify patterns to preserve and
codify; friction identifies gaps to close.

## What does NOT go here

- Operational principles already in the `skmtc-cli` /
  `skmtc-generator` skills (those are captured; repeating is noise).
- Trivial typos or one-line corrections that aren't part of a pattern.
- Domain-specific decisions from consumer projects (only observations
  about SKMTC itself).
- "I made a mistake" without a generalisable lesson.

## How entries are produced

Most entries come from the [`skmtc-retro`](../../../../skmtc-platform/packages/skmtc-retro-skill/SKILL.md)
skill — run after substantive SKMTC work, the skill applies reflection
prompts to identify observations only the LLM can see (guesses,
default overrides, surprises, idiomatic gaps) and writes them in the
project's standard format.

Users can also write entries directly when they notice something worth
logging. Follow the same format and naming convention.

## File format

Each session file starts with a short header:

```markdown
# <YYYY-MM-DD> — <Session topic>

<1-2 sentences describing what work was happening in this session.>

---

### 1. <Entry heading> [severity]
...

### 2. <Entry heading> [severity]
...
```

## Entry format

Each entry within a file:

- **Heading** with severity tag: `[blocker]` / `[friction]` /
  `[polish]` / `[win]`
- **What happened** — concrete description, with code or commands
- **What was expected** — the assumption that turned out wrong (where
  applicable)
- **Why it matters** — the underlying principle violated or pattern
  exemplified (highest-value field)
- **Possible fixes** — open-ended; *not* categorised by where the fix
  should land (skill / doc / code). Leaving this open is deliberate.
- **Version anchor** — which `@skmtc/core` and generator versions the
  observation was made against
- **Status** — `open` or `verified-fixed <date> — <link>`

See the `skmtc-retro` skill for the full reflection process and the
questions the skill applies.

## Severity tags

- `[blocker]` — no workaround found; session got stuck
- `[friction]` — workaround exists; cost real time/cycles
- `[polish]` — annoying but not blocking
- `[win]` — something that worked particularly well

## Numbering

Entries within a single file are numbered sequentially starting at 1.
Numbers are stable within the file — once assigned, they don't change,
even if entries are resolved. There is no global numbering across
files; cross-file references use `<filename>#<N>` format.

## Review cadence

Reviewed daily. Resolved entries are updated in place with their
`Status:` field set to `verified-fixed <date> — <link>`. Entries are
**not deleted** — the log is the project's forensic record of what got
better and when. Resolved files stay in the directory; archive only if
the directory becomes unwieldy.

## On the absence of category tags

The format intentionally omits a "category of fix" tag (skill-gap /
doc-gap / code / design). Auto-tagging the moment friction is observed
forecloses contemplation about the *best* fix in favour of the
*obvious* fix. Leaving "Possible fixes" open-ended encourages
reflection during periodic review rather than locking in the first
idea.

## Related artefacts

- [Retro skill](../skills/skmtc-retro/SKILL.md) — produces entries
- [CLI skill](../skills/skmtc-cli/SKILL.md) — guides CLI work
- [Generator skill](../skills/skmtc-generator/SKILL.md) — guides generator authoring
- [Debug skill](../skills/skmtc-debug/SKILL.md) — diagnoses failures
- [LLMs doc](../llms.md) — operational principles consolidated for AI
  assistants
- [Design philosophy](../explanation/design-philosophy.md) — the
  principles that should not be re-derived from friction entries
