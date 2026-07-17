# RESUME — skmtc-generator skill eval program (2026-07-17 session)

Fresh-agent pickup anchor for the skill-effectiveness work. Everything
below happened in one session on branch
**`docs/generator-skill-model-first`** (~21 commits, **not pushed**).

## Intent

The `skmtc-generator` skill was underperforming: agents authoring
generators produced the wrong *shape* (the reference failure is
`skmtc-generators/gen-kotlin-jackson-s` — all snippets, zero
Projections, hand-registered Definitions). Diagnosis: the skill was a
rulebook without the game — 40 defensive rules, never the constructive
story. The program built this session:

1. **Teach the model, not just the rules** — restructure the skill
   (and `llms.md`) around the generation model narrative.
2. **Measure structurally** — mechanical, no-LLM-judge checks on
   generator source (`packages/gen-eval`), baselined against the
   stock fleet so "good" and "sub-par" have numbers.
3. **Test end-to-end** — a harness that has a model author
   `gen-kotlin-jackson` from scratch in an isolated sandbox, graded
   by ground-truth gates + the structural eval, with full telemetry
   for human diagnosis.
4. **Close the loop** — diagnose → edit skill → re-run (skill SHA +
   task checksum recorded per run) → compare.

Success test (user-defined): a model, given the skill, produces a
clean generator for server code / DTOs in a non-TypeScript language.

## What was built (all on the branch)

### Skill + docs (`deno/docs/`)

- **`skills/skmtc-generator/SKILL.md`** 0.5.0 → **0.6.2**, 1788 →
  ~1400 lines: new §1 "The generation model" (parse → IR → loop →
  producer → Definition → File-as-render-unit+cache →
  self-provisioning → order-independence); §4 merges the old
  principles table + anti-patterns (every rule once, thematically
  grouped); §8 "Emitting a language other than TypeScript" **plus
  0.6.2's "Working method: scaffold first — do not audit the engine"**
  (evidence-driven, see findings); "silhouette of a finished
  generator" (quantitative target shape); artifact-is-a-Projection
  counter-rule; runtime-discipline fact; method-discipline made
  explicit.
- **`llms.md`**: same model-first treatment — "The generation model"
  section before the six facts; facts kept canonical; `Producer` added
  to glossary.
- **`verify-docs.ts` check 1** rewritten: fact-ANCHOR sync (llms.md
  canonical + each fact lead must appear in the skill) instead of the
  old mirrored-list shape. All 13 checks + doc-test + verify-catalog
  green at every commit.

### Structural eval (`packages/gen-eval/`)

Private all-node TS package, no build step (`node src/cli.ts`,
node ≥ 23). One shared AST pass (`src/parse.ts` → `PackageFacts`);
**14 checks, one module each** under `src/checks/`, each documented in
`docs/` (one page per check + index). Aggregate = **defect aggregate**
(`clean` / `warn(m)` / `FAIL(nF+mW)`), deliberately not a weighted
score. `pnpm stock` sweeps `skmtc-generators/` (one row per generator,
one column per check); baseline at `baselines/2026-07-17-stock.{json,md}`.

### Authoring harness (`packages/gen-eval/harness/`)

`harness/run.sh <model> [label]` — full docs in `harness/README.md`:
isolated temp workspace (vendored lang-kotlin, pinned kotlin-demo
schema, gradle consumer with pinned Jackson round-trip tests, JDK21
auto-wired), deny rules + transcript contamination audit, provenance
(skill SHA + snapshot, taskSha, MAX_THINKING_TOKENS), live terminal
timeline, **persistent dashboard** (`http://127.0.0.1:8484/` — run
list with LIVE/done/aborted + per-run scrubber viewer with live
follow), gates (integrity, contamination, clean-generate,
schema-coverage, compile, round-trip) + structural eval → `report.md`,
`runs/index.jsonl` for comparison. Viewer: video-player scrubber,
turn pane with persisted disclosures, file tree + line-numbered code
view reconstructing the workspace per turn (Write/Edit + bash
heredocs). **Narrate-and-log protocol** in `task.md`: `WHY:` intent
lines (visible channel), `FRICTION.md` with per-entry `Unblocker:`
(the model drafts the missing skill content), `RETRO.md` exit retro;
milestones + report integration.

## What we learned (findings, in order of importance)

1. **The baseline validates the checks.** Clean cohort
   (gen-typescript, gen-zod, tanstack pair, gen-msw…) = `clean`;
   `gen-kotlin-jackson-s` = `FAIL(1F+10W)` — zero Projections, its
   single raw `register(context, {definitions: [new KtDefinition…]})`
   IS its whole output path. `gen-md-docs` is the second
   zero-Projection non-accumulator offender. Three stock generators
   carry ad-hoc `{ toString }` objects (arktype — with an as-cast in
   the same expression — reapit-form ×2, reapit-graphql-client).
   toString-purity passes fleet-wide. Accumulator detection is
   evidence-based (defineAndRegister + findDefinition/container
   mutator), which keeps exemptions honest.
2. **Sonnet-5 research-spiral (reproduced ×2, different thinking
   budgets):** on the authoring task it spent 60–112 turns
   `deno doc`-ing `@skmtc/core` symbol-by-symbol and curling core
   source from jsr.io into `/tmp` — zero files written before the
   runs were interrupted. The skill said *what* to write, never *when
   to stop researching* → skill 0.6.2 §8 "scaffold first" is the fix
   under test right now.
3. **Thinking is unrecoverable on current models** — API default
   `display: "omitted"` across ALL Claude Code surfaces
   (headless/interactive/sessions/both auth methods; verified
   empirically incl. `thinking_delta` events carrying 0 chars;
   upstream anthropics/claude-code#36006). Practical answers: the
   viewer/timeline show `redacted (~N tokens)` estimates, and the
   narrate-and-log protocol externalizes rationale via the visible
   text channel.
4. **Headless models write via bash heredocs**, not only the Write
   tool — the viewer's file reconstruction handles both.
5. **Operational lessons:** never edit harness scripts mid-run (bash
   reads lazily — this clipped one run's post-processing); Ctrl-C'd
   runs are auto-detected as `aborted` (no result event + transcript
   quiet 5 min); harness bills against the Claude subscription unless
   `ANTHROPIC_API_KEY` is exported; deno 2.9's dependency-age gate
   did NOT bite (core 0.28.0 old enough, lang-kotlin vendored);
   JDK 21 comes from homebrew via seeded `gradle.properties`.

## State at session end (evening 2026-07-17)

- **A comparison run was LIVE**:
  `runs/20260717-222650-sonnet-after-research-fix` — skill
  `c32790a0` (0.6.2 scaffold-first) + the narrate/friction protocol
  (meta lacks `taskSha` only because run.sh gained that field minutes
  after launch). Early behavior looked right: reading
  `RoundTripTest.kt` by turn 13 instead of excavating core.
- Earlier runs (all interrupted, kept for reference):
  `20260717-213901` (gates 3ok/3fail), `-214222` (112-turn research
  spiral), `-221643-sonnet-shallow-think` (same spiral at
  MAX_THINKING_TOKENS≈2048).
- Dashboard was running on 8484 (`node harness/server.js` if not).
- Branch not pushed; repo has unrelated user WIP (`deno.lock`,
  `deno/CLAUDE.md`, an untracked friction-log entry) deliberately
  left uncommitted.

## Tomorrow — pick up here

1. **Read the after-research-fix run**: dashboard →
   `runs/20260717-222650-…/report.md`, `FRICTION.md`, `RETRO.md`,
   viewer. Key questions: did `src/base.ts written` fire early (fix
   worked)? Which gates pass? What do the Unblockers ask for?
2. **Feed the Unblockers into the skill** (they are pre-drafted skill
   content), bump version, `deno task verify-docs`, re-run labeled.
3. **Run the ceiling**: `harness/run.sh claude-fable-5` (fable also
   redacts thinking; the WHY/friction channels are the visibility).
4. When a run goes green: run 2–3 repeats (noise), then consider
   promoting the authored generator to replace
   `gen-kotlin-jackson-s`, and re-baseline (`pnpm stock:save`).
5. **Push the branch / open the PR** when ready — it contains the
   skill restructure, llms.md, verify-docs change, gen-eval package,
   and harness (21 commits, all gates green).
6. Parked ideas: standalone API-based runner with
   `display:"summarized"` for real reasoning text; additional checks
   (registration-channels promotion to pass/fail once legitimate raw
   uses are adjudicated — see `gen-shadcn-table`'s noExport sibling
   and `gen-kotlin-sdk`'s static-file emitters); wiring gen-eval into
   the skill as a self-check (deliberately NOT done yet — first
   measure the skill's teaching, not linter-looping).

## Crib

```bash
cd skmtc/packages/gen-eval
pnpm stock                                  # structural eval, whole fleet
harness/run.sh <model> [label]              # authoring run (docs: harness/README.md)
node harness/server.js                      # dashboard http://127.0.0.1:8484
cat harness/runs/index.jsonl                # cross-run comparison
# skill lives at deno/docs/skills/skmtc-generator/SKILL.md (symlinked into ~/.claude/skills)
cd ../../deno && deno task verify-docs      # after any skill/docs edit
```
