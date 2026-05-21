# Skills

Operational skills that guide AI assistants working with SKMTC.
Each skill is a subdirectory containing:

- `SKILL.md` — the loadable skill artifact with YAML frontmatter
  (`name`, `version`, `description`, `allowed-tools`) and operational
  content
- `design.md` — design document describing what the skill should
  contain, rationale for content boundaries, content-source mapping,
  and open questions
- `commands/` — optional slash command files for explicit invocation

This directory is the canonical home for skills. The previous location
`skmtc-platform/packages/skmtc-*-skill/` is legacy and has been
superseded.

## The skill ecosystem

| Skill | Purpose | Audience | Status |
|---|---|---|---|
| [`skmtc-architecture/`](skmtc-architecture/) | System mental model — what SKMTC is, how the engine works, how to build infrastructure around it | Infrastructure builders | **SKILL.md authored** (v0.1.0) |
| [`skmtc-cli/`](skmtc-cli/) | Guide CLI usage — install, configure, run, integrate | Users (`using/`) | **SKILL.md authored** (v0.2.0); pulled from legacy + new content |
| [`skmtc-generator/`](skmtc-generator/) | Guide generator authoring and editing | Authors (`extending/`) | Skeletal SKILL.md (v0.1.0-draft); content TBD |
| [`skmtc-debug/`](skmtc-debug/) | Diagnose failures — no output, wrong output, errors | Anyone debugging | Skeletal SKILL.md (v0.1.0-draft); content TBD |
| [`skmtc-retro/`](skmtc-retro/) | Capture session friction/wins to friction log | Anyone (end of session) | Authored (v0.1.0); includes `/skmtc-retro` slash command |

All four skills now live in this directory. The retro skill was moved
here from `skmtc-platform/packages/skmtc-retro-skill/`. The cli skill
was authored anew (content distilled from the legacy 1096-line file);
generator and debug skills are skeletal stubs awaiting fuller content.

## How skills relate to docs

Skills are the **operational layer**; docs are the **reference
layer**. The structural difference shapes the content split:

- **Skills push.** Loaded automatically by intent matching. Constrained
  by working-context budget. Used at the moment of acting.
- **Docs pull.** Loaded on demand (Read tool, navigation). Length-
  unconstrained. Used when investigating.

### Content split

| Content type | Skill | `llms.md` | Reference docs | Concept docs | Explanation docs | Tutorials / recipes |
|---|---|---|---|---|---|---|
| API signatures (full) | — | — | ✓ canonical | — | — | — |
| API signatures (top 3–5) | ✓ inline | ✓ inline | ✓ canonical | — | — | — |
| Operational principles | ✓ canonical (per skill) | ✓ canonical (full) | — | — | — | — |
| Decision trees | ✓ canonical | ✓ | — | — | — | — |
| Anti-patterns (top ~10) | ✓ | ✓ canonical (full) | — | — | — | — |
| Code scaffolds | ✓ canonical | — | — | — | — | (in tutorials) |
| Mental models (compressed) | ✓ | ✓ | — | — | — | — |
| Mental models (full) | — | — | — | ✓ canonical | — | — |
| Design rationale | — | — | — | — | ✓ canonical | — |
| Tradeoffs accepted, alternatives rejected | — | — | — | — | ✓ canonical | — |
| Tutorials, recipes | (pointers) | — | — | — | — | ✓ canonical |
| Per-command reference | (one-liners) | — | ✓ canonical | — | — | — |
| Per-generator reference | (one-liners) | — | ✓ canonical | — | — | — |
| Trigger phrases / skill metadata | ✓ canonical | — | — | — | — | — |

**Rule of thumb:** anything an LLM might need *at the moment of
acting* goes in the skill. Anything the LLM (or a human) might need
*when investigating* goes in the docs.

## Selective duplication policy

Critical operational claims appear in multiple places. This is
intentional, not accidental:

1. **LLMs don't reliably follow links during single-shot reading.** A
   skill that says "see `design-philosophy.md`" is, in practice,
   equivalent to a skill that omits the philosophy.
2. **Positional attention favors content high in the loaded artifact.**
   Critical content needs to appear *high* in multiple artifacts to
   survive attention drift.
3. **Cost asymmetry.** A stale skill produces bad output every time
   it's invoked. A stale reference doc just confuses one human reading
   it. The maintenance investment in skill accuracy is justified.

### What gets duplicated

- **The five facts that override default LLM intuitions** — top of
  every skill, plus `llms.md`. Canonical in `llms.md`.
- **The operational principles table** — full version in
  `llms.md`; subset in each skill, weighted to the skill's audience.
  Canonical in `llms.md`.
- **Decision trees** — same content in skill and in `llms.md`.
  Canonical in skill (since they're operational).
- **Top ~10 anti-patterns with failure modes** — in skill;
  full catalog in `llms.md`. Canonical in `llms.md`.

### Drift management

Each duplicated artifact has one designated canonical home. Other
places derive from it. When the canonical version updates, the
derivatives should be reviewed. This is a manual discipline today; a
CI lint comparing hash-of-table-rendered could enforce it if drift
becomes a problem.

## Boundaries between skills

Skills overlap in trigger conditions but should have clear primary
ownership:

- **skmtc-architecture** owns: the system mental model — what SKMTC
  is, how the engine works, how to build infrastructure around it.
  The "understand the system" path; precedes the other three.
- **skmtc-cli** owns: installing, configuring, running, integrating
  with CI. The "normal usage" path.
- **skmtc-generator** owns: writing, cloning, editing generator code.
  The "extending" path.
- **skmtc-debug** owns: diagnosing failures. The "broken" path. Applies
  across both cli and generator contexts.
- **skmtc-retro** owns: end-of-session reflection. The "what did we
  learn" path. Distinct from all three by being meta-work.

When triggers overlap (e.g., "my generator's output is wrong" — is
that generator or debug?), the principle is: **whichever skill's
operational stance the LLM should be in.** "My generator's output is
wrong" → debug, because the verify-first stance is required.

## How outlines (this directory) relate to live skills

Each outline file in this directory describes what the corresponding
`SKILL.md` file in `skmtc-platform/packages/<skill-name>/` should
contain. The outline is the *design document*; the SKILL.md is the
*implementation*.

When the implementation diverges from the outline, one of them is
wrong:

- If the outline is wrong, update it to match the implementation.
- If the implementation is wrong, update the skill to match the
  outline.

Either way, drift between outline and skill should be a noticed
condition, not a quiet one. The friction log is the venue for surfacing
"the skill said X but the outline says Y" observations.

## Open questions across all skills

A few cross-cutting questions worth resolving as the skills mature:

### Boundary between skill and llms.md

`llms.md` and the skills both contain operational content for LLMs.
The current cut: `llms.md` is the **canonical aggregation** (read by
LLMs explicitly directed to it); skills are **role-specific digests**
(loaded by intent matching).

Open question: should `llms.md` mostly defer to skills (when a skill
exists for the role) and shrink? Or stay as the canonical operational
reference?

### Skill versioning

Currently each `SKILL.md` has a `version:` field. How do these versions
evolve? Per-bug-fix? Per-feature? Same cadence as `@skmtc/core`?

### How outlines and skills stay in sync

When a skill is updated, the outline should reflect the change (or
vice versa). Today this is manual. As skills evolve, a CI check could
verify that the outline references the right sections, the right
example code, the right anti-pattern count.

### How retro entries graduate into skill / doc updates

The retro skill produces friction-log entries. Some entries indicate
skill gaps. The path from "friction logged" → "skill updated" is
currently manual. As the volume of entries grows, a tighter loop
(e.g., a weekly script that surfaces "entries referencing the skill")
may help.
