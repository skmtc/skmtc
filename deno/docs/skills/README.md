# Skills

Operational skills that guide AI assistants working with SKMTC. Each skill is a
subdirectory containing:

- `SKILL.md` — the loadable skill artifact with YAML frontmatter (`name`,
  `version`, `description`, `allowed-tools`) and operational content
- `design.md` — design document describing what the skill should contain,
  rationale for content boundaries, content-source mapping, and open questions
- `commands/` — optional slash command files for explicit invocation

This directory is the canonical home for skills. The previous location
`skmtc-platform/packages/skmtc-*-skill/` is legacy and has been superseded.

## The skill ecosystem

| Skill                                              | Purpose                                                                                                                                                                                  | Audience                | Status                                                                                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`skmtc-architecture/`](skmtc-architecture/)       | System mental model — what SKMTC is, how the engine works, how to build infrastructure around it                                                                                         | Infrastructure builders | **SKILL.md authored** (v0.1.0)                                                                                                                                    |
| [`skmtc-cli/`](skmtc-cli/)                         | Guide CLI usage — install, configure, run, integrate                                                                                                                                     | Users (`using/`)        | **SKILL.md authored** (v0.4.0); pulled from legacy + new content                                                                                                  |
| [`skmtc-generator/`](skmtc-generator/)             | Guide generator authoring and editing                                                                                                                                                    | Authors (`authoring/`)  | **SKILL.md authored** (full: operational principles, scaffolds, task cards, variants)                                                                             |
| [`skmtc-debug/`](skmtc-debug/)                     | Diagnose failures — no output, wrong output, errors                                                                                                                                      | Anyone debugging        | **SKILL.md authored** (verify-first stance)                                                                                                                       |
| [`skmtc-retro/`](skmtc-retro/)                     | Capture session friction/wins to friction log                                                                                                                                            | Anyone (end of session) | Authored (v0.1.0); includes `/skmtc-retro` slash command                                                                                                          |
| [`skmtc-retro-review/`](skmtc-retro-review/)       | Aggregate friction logs across sessions into patterns, priorities, and convergence metrics                                                                                               | Anyone (periodic)       | Authored; includes `/skmtc-retro-review` slash command                                                                                                            |
| [`skmtc-lang-typescript/`](skmtc-lang-typescript/) | The TypeScript target-language layer — the shape of emitted TS                                                                                                                           | Generator authors       | Authored; the TEMPLATE for `skmtc-lang-<X>` skills (remaining language layers are pre-alpha — no skills until they stabilize)                                     |
| [`skmtc-lang-kotlin/`](skmtc-lang-kotlin/)         | The Kotlin target-language layer — head+value rendering, packages from paths, the value composition classes                                                                              | Generator authors       | Authored (v0.1.0, on the lang-typescript template); source↔skill sync enforced by `verify-docs`                                                                   |
| [`docs-writing/`](docs-writing/)                   | Documentation craft — audience, Diátaxis content types + compass, style/word rules, procedures, structure for humans + AI, API docs, page templates, mechanical enforcement, maintenance | Anyone writing docs     | **SKILL.md authored** (v0.2.0; Mintlify + Diátaxis + Google/Microsoft style guides + EPPO + WTD + Docs for Developers; companions `templates.md`, `mechanics.md`) |
| [`skmtc-generator-v3/`](skmtc-generator-v3/)       | Generator authoring, third generation — engine mental model first (object trees over string concatenation), authored from scratch against a 2026-07-31 source sweep                      | Authors                 | Authored (v0.1.0); runs ALONGSIDE `skmtc-generator`/v2 pending eval comparison; design + eval plan in `notes/skills-tools/` (local)                               |
| [`skmtc-lang-typescript-v3/`](skmtc-lang-typescript-v3/) | TypeScript target-language layer, v3 companion to `skmtc-generator-v3`                                                                                                             | Authors                 | Authored (v0.1.0); pairs only with `skmtc-generator-v3`                                                                                                           |
| [`skmtc-lang-kotlin-v3/`](skmtc-lang-kotlin-v3/)   | Kotlin target-language layer, v3 companion to `skmtc-generator-v3`; teaches lang-kotlin HEAD API (shipped gen-kotlin-\* are API-stale)                                                   | Authors                 | Authored (v0.1.0); worked example pinned byte-for-byte by `lang-kotlin/src/skill-v3-example.test.ts`                                                              |

All skills live in this directory. The retro skill was moved here from
`skmtc-platform/packages/skmtc-retro-skill/`; the cli skill was authored anew
(content distilled from the legacy 1096-line file). Every skill in the table
has a fully authored `SKILL.md`.

## How skills relate to docs

Skills are the **operational layer**; docs are the **reference layer**. The
structural difference shapes the content split:

- **Skills push.** Loaded automatically by intent matching. Constrained by
  working-context budget. Used at the moment of acting.
- **Docs pull.** Loaded on demand (Read tool, navigation). Length-
  unconstrained. Used when investigating.

### Content split

| Content type                              | Skill                   | `llms.md`          | Reference docs | Concept docs | Explanation docs | Tutorials / recipes |
| ----------------------------------------- | ----------------------- | ------------------ | -------------- | ------------ | ---------------- | ------------------- |
| API signatures (full)                     | —                       | —                  | ✓ canonical    | —            | —                | —                   |
| API signatures (top 3–5)                  | ✓ inline                | ✓ inline           | ✓ canonical    | —            | —                | —                   |
| Operational principles                    | ✓ canonical (per skill) | ✓ canonical (full) | —              | —            | —                | —                   |
| Decision trees                            | ✓ canonical             | ✓                  | —              | —            | —                | —                   |
| Anti-patterns (top ~10)                   | ✓                       | ✓ canonical (full) | —              | —            | —                | —                   |
| Code scaffolds                            | ✓ canonical             | —                  | —              | —            | —                | (in tutorials)      |
| Mental models (compressed)                | ✓                       | ✓                  | —              | —            | —                | —                   |
| Mental models (full)                      | —                       | —                  | —              | ✓ canonical  | —                | —                   |
| Design rationale                          | —                       | —                  | —              | —            | ✓ canonical      | —                   |
| Tradeoffs accepted, alternatives rejected | —                       | —                  | —              | —            | ✓ canonical      | —                   |
| Tutorials, recipes                        | (pointers)              | —                  | —              | —            | —                | ✓ canonical         |
| Per-command reference                     | (one-liners)            | —                  | ✓ canonical    | —            | —                | —                   |
| Per-generator reference                   | (one-liners)            | —                  | ✓ canonical    | —            | —                | —                   |
| Trigger phrases / skill metadata          | ✓ canonical             | —                  | —              | —            | —                | —                   |

**Rule of thumb:** anything an LLM might need _at the moment of acting_ goes in
the skill. Anything the LLM (or a human) might need _when investigating_ goes in
the docs.

## Selective duplication policy

Critical operational claims appear in multiple places. This is intentional, not
accidental:

1. **LLMs don't reliably follow links during single-shot reading.** A skill that
   says "see `design-philosophy.md`" is, in practice, equivalent to a skill that
   omits the philosophy.
2. **Positional attention favors content high in the loaded artifact.** Critical
   content needs to appear _high_ in multiple artifacts to survive attention
   drift.
3. **Cost asymmetry.** A stale skill produces bad output every time it's
   invoked. A stale reference doc just confuses one human reading it. The
   maintenance investment in skill accuracy is justified.

### What gets duplicated

- **The five facts that override default LLM intuitions** — top of every skill,
  plus `llms.md`. Canonical in `llms.md`.
- **The operational principles table** — full version in `llms.md`; subset in
  each skill, weighted to the skill's audience. Canonical in `llms.md`.
- **Decision trees** — same content in skill and in `llms.md`. Canonical in
  skill (since they're operational).
- **Top ~10 anti-patterns with failure modes** — in skill; full catalog in
  `llms.md`. Canonical in `llms.md`.

### Drift management

Each duplicated artifact has one designated canonical home. Other places derive
from it. When the canonical version updates, the derivatives should be reviewed.
This is a manual discipline today; a CI lint comparing hash-of-table-rendered
could enforce it if drift becomes a problem.

## Boundaries between skills

Skills overlap in trigger conditions but should have clear primary ownership:

- **skmtc-architecture** owns: the system mental model — what SKMTC is, how the
  engine works, how to build infrastructure around it. The "understand the
  system" path; precedes the other three.
- **skmtc-cli** owns: installing, configuring, running, integrating with CI. The
  "normal usage" path.
- **skmtc-generator** owns: writing, cloning, editing generator code. The
  "extending" path.
- **skmtc-debug** owns: diagnosing failures. The "broken" path. Applies across
  both cli and generator contexts.
- **skmtc-retro** owns: end-of-session reflection. The "what did we learn" path.
  Distinct from all three by being meta-work.

When triggers overlap (e.g., "my generator's output is wrong" — is that
generator or debug?), the principle is: **whichever skill's operational stance
the LLM should be in.** "My generator's output is wrong" → debug, because the
verify-first stance is required.

## How design docs relate to live skills

Each skill directory holds both artifacts: `design.md` is the _design
document_ (what the skill should contain and why those boundaries), and
`SKILL.md` is the _implementation_ that gets loaded.

When the implementation diverges from the design doc, one of them is wrong:

- If the design doc is wrong, update it to match the implementation.
- If the implementation is wrong, update the skill to match the design doc.

Either way, drift between design doc and skill should be a noticed condition,
not a quiet one. The friction log is the venue for surfacing "the skill said X
but the design doc says Y" observations.

## Open questions across all skills

A few cross-cutting questions worth resolving as the skills mature:

### Boundary between skill and llms.md

`llms.md` and the skills both contain operational content for LLMs. The current
cut: `llms.md` is the **canonical aggregation** (read by LLMs explicitly
directed to it); skills are **role-specific digests** (loaded by intent
matching).

Open question: should `llms.md` mostly defer to skills (when a skill exists for
the role) and shrink? Or stay as the canonical operational reference?

### Skill versioning

Currently each `SKILL.md` has a `version:` field. How do these versions evolve?
Per-bug-fix? Per-feature? Same cadence as `@skmtc/core`?

### How outlines and skills stay in sync

When a skill is updated, the outline should reflect the change (or vice versa).
Today this is manual. As skills evolve, a CI check could verify that the outline
references the right sections, the right example code, the right anti-pattern
count.

### How retro entries graduate into skill / doc updates

The retro skill produces friction-log entries. Some entries indicate skill gaps.
The path from "friction logged" → "skill updated" is currently manual. As the
volume of entries grows, a tighter loop (e.g., a weekly script that surfaces
"entries referencing the skill") may help.
