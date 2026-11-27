# Skills

Operational skills that guide AI assistants working with Skmtc. Each skill is a
subdirectory containing:

- `SKILL.md` — the loadable skill artifact with YAML frontmatter (`name`,
  `version`, `description`, `allowed-tools`) and operational content
- `design.md` — design document describing what the skill should contain,
  rationale for content boundaries, content-source mapping, and open questions
- `commands/` — optional slash command files for explicit invocation
- `references/` — optional pages that `SKILL.md` routes to, read only when the
  work reaches them
- `scripts/` — optional tools the skill tells the agent to run

This directory is the canonical home for skills. The previous location
`skmtc-platform/packages/skmtc-*-skill/` is legacy and has been superseded.

## The skill ecosystem

Two skills are **published**: installable by anyone with a skills-capable
agent, listed in `.claude-plugin/marketplace.json`, and rendered on skmtc.dev.
The rest are **internal** — they stay in this directory, carry
`metadata.internal: true` in frontmatter so `npx skills` hides them, and the
plugin manifests do not list them.

The published skills ship as two Claude Code plugins. `skmtc` (this folder's
`.claude-plugin/plugin.json`) carries the generator-authoring skill and
is the plugin submitted to the Claude directory. `skmtc-cli` is a plugin of its
own: a `marketplace.json` entry whose source is the `skmtc-cli/` folder, with no
`plugin.json`. It stays out of `skmtc` because its CI deploy steps read
`$SKMTC_HUB_TOKEN` and its install step runs `curl … | sh`, which the directory
holds for review. So `skmtc-cli/` must not link to files outside its folder: an
install copies only that folder. The `skmtc` marketplace entry lists
`skmtc-cli` under `dependencies`, so installing `skmtc` installs both. The
dependency is in `marketplace.json`, not `plugin.json`, so the directory copy
of `skmtc` depends on nothing. Both plugins share one version, which
`deno task bump-plugin` moves together.

### Published

| Skill | Purpose | Version |
| --- | --- | --- |
| [`skmtc-generator/`](skmtc-generator/) | Writing and editing generators: producers, what Skmtc already does, the steps, and the finish pass, with references and a skeleton | 0.17.0 |
| [`skmtc-cli/`](skmtc-cli/) | When to use the CLI and how to reach its guide. The guide itself is in the CLI: `skmtc guide` | 0.6.1 |

`skmtc-generator` is one skill, so an author loads one thing. Its
`SKILL.md` holds what every path needs: what a producer is, the table of what
Skmtc already does, the steps, what to do when a case does not fit, the rules
and the done list. It routes to the rest by path:

| File | Holds | Before 0.17.0 |
| --- | --- | --- |
| `references/producers.md` | How to split output into producers, with the wrong and right form of each rule | new |
| `references/engine.md` | The cache, peers, variants, enrichments, options | `skmtc-generator` sections 2 and 4 to 7 |
| `references/typescript.md` | The TypeScript layer; `verify-docs` holds it to the lang package | the `skmtc-lang-typescript` skill |
| `references/model.md` | Model generators and the skeleton's slots | the `skmtc-model` skill |
| `references/operation.md` | Operation generators | the `skmtc-operation` skill |
| `references/finish.md` | The last step: measure, read the diff for named patterns, check, report | new |
| `scripts/complexity.ts` | Cyclomatic complexity of each function, with a limit of 10 | new |
| `skeleton/` | A model generator to copy, tested against the engine | `skmtc-model/skeleton/` |

The split rule: what every path needs, and what an agent gets wrong when it
does not read it, is in `SKILL.md`. A page that only some paths reach, or that
is looked up, is a reference.

`skmtc-cli` is a pointer. It says when to use the CLI and sends the agent to
`skmtc agent-context` and `skmtc guide`. The guide (the workspace model, the
agent contract, the config reference and the task recipes) is in the CLI, at
`deno/cli/guide/*.md`. A skill installs from this repository's main branch,
and the CLI's own text matches the version that runs, so text about commands
belongs in the CLI. Until 0.6.0 that text was this skill's `reference.md` and
`task-cards.md`.

### Internal

| Skill | Purpose | Why it stays internal |
| --- | --- | --- |
| [`skmtc-architecture/`](skmtc-architecture/) | System mental model for building infrastructure around Skmtc | Platform-team audience, not generator authors |
| [`skmtc-debug/`](skmtc-debug/) | Diagnose failures — no output, wrong output, errors | Leans on repo-internal diagnostics |
| [`skmtc-graphql/`](skmtc-graphql/) | The GraphQL SDL pipeline, alongside `skmtc-generator` | GraphQL input is not yet a supported public path |
| [`skmtc-lang-kotlin/`](skmtc-lang-kotlin/) | The Kotlin target-language layer; source↔skill sync enforced by `verify-docs`, worked example pinned by `lang-kotlin/src/skill-example.test.ts` | Kotlin publication deferred |
| [`skmtc-retro/`](skmtc-retro/) | Capture session friction/wins to the friction log | Internal feedback tooling |
| [`skmtc-retro-review/`](skmtc-retro-review/) | Aggregate friction logs into patterns and priorities | Internal feedback tooling |
| [`docs-writing/`](docs-writing/) | Documentation craft — Diátaxis, style rules, page templates | Internal authoring tooling |

The published names carry no version: the public name is the stable
identity, and `version` frontmatter plus git history carry the generation.
`skmtc-lang-typescript` (last 0.3.3), `skmtc-model` (last 0.3.2) and
`skmtc-operation` (last 0.1.4) were published skills until `skmtc-generator`
0.17.0 took their content as references; git keeps their history.

**Versioning rule: a `version` belongs to the public name and only ever moves
forward.** Replacing the content behind a name continues that name's line
rather than restarting it — `skmtc-generator` went 0.12.0 → 0.13.0 and
`skmtc-cli` 0.4.1 → 0.5.0 when the v3 content took those names, and
`skmtc-lang-kotlin` 0.10.0 → 0.11.0 when it took that one. A reader who has an
older copy can then compare numbers and get the right answer. The tables above
are checked against frontmatter by `verify-docs`, so a version edited in one
place and not the other fails the gate.

## What keeps these true

A skill that has drifted from the engine is worse than no skill: it is read as
authority and acted on without checking. Every guard below runs in
`deno task check`, which CI runs on each pull request.

| Guard | What it catches | Where |
| --- | --- | --- |
| Fact-anchor sync | An `llms.md` fact clause missing from `skmtc-generator` (its `SKILL.md` and its references) | `verify-docs` |
| Lang source↔skill sync | An identifier factory or value-protocol guard the lang page never mentions, or an entity-kind count that moved (the Kotlin skill, and `skmtc-generator/references/typescript.md`) | `verify-docs` |
| CLI reference sync | A `cli/mod.ts` command missing from the reference pages, in both directions | `verify-docs` |
| CLI guide sync | `cli/guide/topics.json` out of step with `cli/guide/*.md`, a topic that names a command the CLI does not have, a `skmtc guide <topic>` in a page or a skill that is not a topic, or `skmtc-cli` no longer pointing at `skmtc guide` | `verify-docs` (fix the first with `deno task build-guide`) |
| Skills catalogue sync | A README row, frontmatter version, `metadata.internal` flag or plugin manifest membership disagreeing with the others | `verify-docs` |
| Generated-appendix coverage | An export missing from the appendix, because it was not regenerated after the API moved | `verify-docs` (names, not formatting — `deno doc`'s layout shifts between patch releases; `generate-skill-api-appendix.ts --check` does the exact comparison locally) |
| Declared-version sync | A skill still declaring a package minor the workspace has moved past | `verify-docs` |
| Public-API-surface sync | An export of `@skmtc/core` or `@skmtc/lang-typescript` added, removed or re-shaped while the package minor stayed put — the change declared-version sync cannot see. Blind spot: a factory that returns an anonymous class (`toModelProjectionBase` and siblings, the lang veneers) has no return type in `deno doc`, so the class it returns (the insert wrappers, `register`, `this.options`) is outside the digest; those exports are listed as `unresolved` in the record | `verify-docs` (per-export digests in `.scripts/api-surface.json`; fix with `deno task bump <package> --minor`, which hands the reread to declared-version sync, then `deno task record-api-surface`) |
| Doc-test | A renamed export breaking a fenced `ts` block a skill or one of its references quotes | `doc-test` |
| Worked-example pins | The Kotlin skill's example, and the model skeleton, no longer producing what they promise | `deno test` |
| Plugin-version freshness | A published skill edited without bumping the plugin version, so no installed plugin ever sees it | `verify-docs` (digest of the published skills and the plugin manifest; fix with `deno task bump-plugin`) |
| One install source | A second copy of the install lines, which drifts from the canonical one | `verify-docs` |
| Release refusal | A release moving past a minor a skill declares | `deno task release` |

The last two rows are the ones that catch a changed *rule* rather than a
renamed *symbol*. Name-level checks cannot see a default that flipped or a step
that became required; a pinned example fails on it, and the declared-version
gate forces a human to reread the skill before the release goes out. Editing
the declared number is the record that someone looked.

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

- **skmtc-architecture** owns: the system mental model — what Skmtc is, how the
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
