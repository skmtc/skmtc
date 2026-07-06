# docs-writing skill — design document

## Purpose

A craft skill: how to write good documentation, loaded at the moment of writing
or reviewing any docs page. Unlike the `skmtc-*` skills it is not SKMTC-specific
— the content is general documentation craft — but it lives in this ecosystem
because the SKMTC docs tree is its primary application surface, and because the
docs tree already instantiates the skill's central framework (Diátaxis) in its
directory layout (`using/tutorials/`, `using/how-to/`, `using/recipes/`,
`reference/`, `concepts/`, `explanation/`).

## Artifact layout (v0.2.0)

- `SKILL.md` — the operational core, loaded on invocation: the seven principles,
  audience, Diátaxis (+ compass), style and word rules, procedures, structure,
  code examples, API docs, maintenance, checklist, task cards.
- `templates.md` — page skeletons + quality bars for eight page types; read on
  demand when drafting a page of that type.
- `mechanics.md` — the automatable subset (Vale, markdownlint, lychee,
  doc-testing) and the llms.txt format; read when wiring CI or the machine
  surface, not when writing prose.

The split follows the ecosystem's skills-push/docs-pull model: material needed
at the moment of writing stays in SKILL.md; material needed when setting up
checks or starting a specific page type moves to companions.

## Content sources

v0.1.0 was distilled July 2026 from Mintlify's published documentation-craft
material (itself compiled from interviews with technical writers at Stripe,
Amplitude, Anaconda, GitHub) plus the Diátaxis four-type model. v0.2.0
diversified the source base to correct the single-vendor emphasis.

| Section                         | Source                                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Seven principles             | §1.1 original (verify-first, the agent-as-writer stance, mirroring `skmtc-debug`); §1.2 Mintlify; §1.3 Mintlify + NN/g (F-pattern, ~20% reading); §1.4 Mintlify + Docs for Developers (validation); §1.5 Every Page Is Page One (Baker); §1.6 Mintlify; §1.7 Mintlify + Write the Docs ("incorrect worse than missing") |
| §2 Know your audience           | Mintlify `know-your-audience` + five W's; friction log from Docs for Developers; "assume the reader is qualified" from EPPO                                                                                                                                                                                             |
| §3 Content types                | diataxis.fr in depth: the compass, tutorials-vs-how-to (type ≠ difficulty), per-type voice ("we", conditional imperatives, the "About" test), complex-hierarchies (recipes ruling), incremental application, "always complete never finished" (Procida)                                                                 |
| §4 Style and tone               | Mintlify `writing-style-tips`; word-level rules from the Google style guide (word list, tense, anthropomorphism, timeless docs) + Microsoft (top 10 tips, bias-free, global comms); brevity/explicitness scoping rule original (see decision log)                                                                       |
| §5 Procedures                   | Google `procedures` + Microsoft step-by-step instructions                                                                                                                                                                                                                                                               |
| §6 Structure                    | Mintlify `navigation`/`seo` + EPPO (context, one level, link richly, conform to type) + NN/g information scent                                                                                                                                                                                                          |
| §7 Code examples                | Mintlify + Google placeholder conventions; testing pointer to mechanics.md                                                                                                                                                                                                                                              |
| §8 API documentation            | Mintlify API-docs recommendations (components table, Stripe/Twilio exemplars, time-to-first-call)                                                                                                                                                                                                                       |
| §9 Templates pointer            | templates.md: Good Docs Project, Keep a Changelog 1.1.0, Art of README, standard-readme                                                                                                                                                                                                                                 |
| §10 Media                       | Mintlify `media`, compressed                                                                                                                                                                                                                                                                                            |
| §11 Discoverability             | Mintlify `seo`, compressed; AEO = §6 framing retained                                                                                                                                                                                                                                                                   |
| §12 Maintenance                 | Mintlify `maintenance` + WTD ARID + Docs for Developers (editing passes, deprecate-before-delete, ownership)                                                                                                                                                                                                            |
| §13 Measuring success           | Mintlify `success` + traffic × rating grid                                                                                                                                                                                                                                                                              |
| §14–15 Checklist and task cards | Original synthesis in the house skill style; updated for verify-first, compass, templates, editing passes                                                                                                                                                                                                               |
| mechanics.md                    | vale.sh docs + errata-ai packages; markdownlint; lychee; GitLab docs pipeline; pytest-examples/MDX/mdbook; llmstxt.org + adoption reporting                                                                                                                                                                             |
| templates.md                    | Good Docs Project template repo (how-to, tutorial, reference, concept, README, changelog, release notes, troubleshooting); Keep a Changelog 1.1.0; Art of README; standard-readme spec                                                                                                                                  |

## Decision log — contested seams

Where credible sources disagree, the skill encodes one side rather than
presenting options (a skill offering "A or B" just re-litigates the choice every
invocation). Each entry records the tension, the chosen side, and why — so
future maintainers don't "fix" a decision without knowing it was one.

1. **Diátaxis type purity vs. Stripe-style blended pages.** Both work; mixed
   per-page adoption nullifies both. Chosen: purity governs the docs tree (type
   declared by directory); the workflow-blend is a _scoped carve-out_ for API
   reference surfaces only (§3 smells + §8). Rationale: the tree is already
   committed to type-per-directory, and the carve-out matches how the pattern is
   actually used by its exemplars.
2. **"Cut ruthlessly" vs. "restate context" (brevity vs. explicitness).**
   Chosen: a scoping rule — brevity governs within a sentence/paragraph;
   explicitness governs page and section _boundaries_ (openings, prerequisites,
   restated subjects), since boundaries are retrieval/entry points (EPPO + AEO).
   "Cut words, not context." (§4 first bullet.)
3. **Exhaustive reference vs. don't document niche edge cases.** Chosen: scoped
   by type — exhaustiveness is a property of reference _within its declared
   scope_; edge-case triage applies to guides (§2 last bullet, §3 reference
   rules).
4. **"click" (Google) vs. "select" (Microsoft).** Chosen: select —
   input-neutral, accurate for keyboard/touch/assistive tech, no per-device
   forking (§4 word rules).
5. **Menu-path separator bolding (Google bolds the whole path; Microsoft doesn't
   bold ">").** Chosen: bold items with ">" separators, one convention
   throughout — consistency matters more than the variant (§5).
6. **DRY vs. duplication.** Chosen: ARID with designated canonical homes (§12),
   which is also the ecosystem's existing selective-duplication policy — a
   synthesis with a drift-check mechanism, not an average.
7. **Voice register (Microsoft's marketing-brisk vs. Google's
   restrained-conversational).** Chosen: Google's restraint — developers read
   docs under stress; contractions yes, chirpiness no.
8. **Recipes vs. the four types.** Resolved, not contested: diataxis.fr itself
   names the recipe as the model how-to form and says the four types classify
   needs, not directory names (§3).

## Content boundaries

**In scope:** the craft of a docs page — audience, type selection, style,
structure, examples, media, discoverability, maintenance process, metrics — plus
page templates and the mechanical enforcement toolbox as companions. Applies to
any project's docs.

**Out of scope, deliberately:**

- _Where SKMTC content goes_ (skill vs `llms.md` vs docs tree, the
  selective-duplication policy, canonical homes) — owned by
  `docs/skills/README.md`. The SKILL.md description points there.
- _Writing SKILL.md files themselves_ — skills are an operational artifact with
  their own conventions (frontmatter, trigger phrases, anti-pattern tables); a
  future `skill-authoring` skill could own that.
- _Mintlify the product_ (mint.json, components, hosting) — this skill takes
  their writing guidance, not their tooling.
- _Specific Vale rule catalogs beyond the examples_ — mechanics.md shows the
  patterns; a project's actual rule set lives with the project.

## Design choices

- **Name is unprefixed** (`docs-writing`, not `skmtc-docs-writing`) because the
  content is project-agnostic. The SKMTC-specific touches — the tree mapping and
  the `verify-docs.ts` / friction-log pointers — are kept minimal so the skill
  stays portable.
- **House style preserved**: numbered sections, "principles that override
  default intuitions" opener, decision tables, task cards, and a verification
  checklist, matching `skmtc-generator` / `skmtc-cli` so the skill family reads
  uniformly.
- **"Seven principles" framing** mirrors the "N facts" opener convention of the
  sibling skills. Verify-first was added as principle #1 in v0.2.0 because the
  skill's writer is usually an LLM, and LLM-written docs fail differently from
  human-written docs (hallucinated flags, documented intent vs. behavior) — the
  highest-leverage correction goes first.
- **AI-agent readership is folded into every structural section** rather than
  ghettoized in one — AEO and human skimmability are the same optimization. The
  agent-as-_writer_ stance (verify-first) is separate and lives in §1.1.
- **Companions over one mega-file**: templates and mechanics are needed at
  different moments than the craft rules; splitting keeps the loaded artifact
  dense (positional attention, context budget) while the companions stay a Read
  away.

## Changelog

- **0.2.0 (July 2026)** — diversified sources beyond Mintlify (Diátaxis in
  depth, Google/Microsoft style guides, EPPO, Write the Docs, Docs for
  Developers, NN/g, Good Docs Project, Keep a Changelog, llms.txt, Vale). Added:
  verify-first principle (§1.1), the compass, type≠difficulty, per-type voice,
  recipes ruling, incremental application, word-level bad→good rules, global-
  audience rules, procedures section, EPPO structure rules (context / one level
  / link richly / conform to type), information scent, editing passes, ARID,
  deprecate-before-delete, llms.txt. Resolved the contested seams (decision log
  above). Split templates.md and mechanics.md out as companions. Compressed
  media/SEO/metrics. Added Bash to allowed-tools (running examples is part of
  the craft).
- **0.1.0 (July 2026)** — initial distillation from Mintlify guides plus the
  Diátaxis four-type model.

## Verification loop (wired 2026-07-06)

- **CI counterpart** — `deno/docs/verify-docs.ts` checks 4 and 5: the §3
  Diátaxis tree mapping stays in sync with the real directory layout (both
  directions, incl. the extending-mirrors-using claim), and a zero-tolerance
  filler-word guard (`simply`/`easily`/`obviously`/`as of this writing`) across
  the reader-facing tree. "just" and "currently" are deliberately not checked —
  too many legitimate uses (version-scoped capability statements); those stay a
  review concern. The seven pre-existing filler hits were fixed when the guard
  landed.
- **Eval coverage** — `docs/evals/tasks/rewrite-flawed-page.md`: a flawed how-to
  page whose central fault is factual drift against a ground-truth CLI
  (`--force` documented, `--overwrite` real), plus the §4/§5/§6 prose faults.
  The llm-judge rubric is keyed to the §14 checklist; the fixture self-verifies
  the tool's real behavior and the planted faults. Fails any rewrite that keeps
  invented flags, however clean the prose — the verify-first discriminator.

## Open questions

- Does this skill need trigger wiring into the user-level skill list
  (`~/.claude/skills/`) like the `skmtc-*` skills, or is repo-local loading
  sufficient? (Currently symlinked at user level.)
- Whether §10–§11 (media, discoverability) should also move to a companion if
  SKILL.md grows further.
