# Skills, tools, and the generator-authoring harness — plan

Written 2026-07-31. Scope: the v3 skill suite for generator authoring, the
agent-facing feedback tools, the evaluation system for both, and the
longer-arc "agentic generator authoring" harness (Pi/Flue). Companion
conversation covered pi.dev + flueframework.com review and the
exemplar-anchored harness design; the durable parts are recorded here.

Status markers: ✅ done · 🚧 in progress · ⏳ planned · 💡 design only.
Tickable execution items live in `CHECKLIST.md` (same directory); this file
holds the rationale, decisions, and gate definitions. Durable session
analyses (findings with evidence, infrastructure learnings) live in
`learnings/`.

## 0. Why v3 exists

Agents arrive with zero SKMTC knowledge and one strong prior: "codegen =
template strings." Past attempts showed agents defaulting to string
concatenation — familiar territory, instant visible output — producing
short-lived results that could not carry imports, be referenced by peer
generators, or survive the first nontrivial schema. v3's job is to replace
that prior with the engine's actual model *before* the first line of code,
and to surround the agent with feedback that makes the object-tree path
more observable than the string path.

Ground rules for this suite (decisions, 2026-07-31):

- **From-scratch authorship.** No prior skill content read; everything
  grounded in a fresh source sweep of `@skmtc/core@0.28.3`,
  `@skmtc/lang-typescript@0.12.17`, `@skmtc/lang-kotlin@0.9.14` (HEAD), and
  the stock generators (gen-zod, gen-tanstack-query-fetch-zod,
  gen-kotlin-kotlinx, gen-kotlin-spring, gen-kotlin-sdk).
- **Stable API names, never file:line, in skill text.** Line numbers rot
  silently; names fail loudly at compile time. Version-sensitive claims are
  dated.
- **Naming**: `skmtc-generator-v3`, `skmtc-lang-typescript-v3`,
  `skmtc-lang-kotlin-v3` — the existing v2/lang skills stay untouched
  alongside (user decision 2026-07-31, reversing an initial replace-in-place).
- **lang-kotlin API of record is the workspace HEAD**, not the shipped
  generators: the `skmtc-generators` Kotlin packages predate the
  lang-kotlin 0.9.11 API flattening (`KtAnnotation` object-args +
  self-registering imports; `KtSupertyped` dissolved). The Kotlin skill
  teaches HEAD and flags the drift.

## 1. Workstream A — the v3 skills

Location: `skmtc/deno/docs/skills/`.

- **A1 ✅ Source research.** Three parallel sweeps (core engine authoring
  surface; lang-typescript + TS generators; lang-kotlin + Kotlin
  generators), everything cited file:line in the session reports. Key
  facts now encoded: three-phase pipeline with `toString()` running only in
  `RenderContext.collate`; identity-before-construction via projection
  statics; the cache IS the file map, keyed `(identifier.name, exportPath)`;
  Drivers construct on miss / reuse on hit and stitch peer imports;
  the three register call shapes; the three-file package convention
  (`mod.ts` default export, `base.ts`, `enrichments.ts`); the three-scope
  enrichment umbrella; variant threading; `operationId` never used in stock
  naming; the two lint rules (`skmtc/no-template-imports`,
  `skmtc/no-adhoc-tostring`) that mechanically enforce the object-tree
  doctrine.
- **A2 ✅ `skmtc-generator-v3/SKILL.md`.** Engine skill, language-blind.
  Structure enforces the on-ramp: §1 what SKMTC is (zero-knowledge intro,
  clone-to-customize, division of labor) → §2 the one law + the named trap
  + litmus test → §3 concepts → §4–5 engine loop & memoization → §6 package
  anatomy → §7–9 enrichments/variants/naming → §10 reorientation working
  method → §11 pitfall table → §12 handoff to lang skills.
- **A3 ✅ `skmtc-lang-typescript-v3/SKILL.md`.** Concrete layer: base
  factories, TsSnippet, three register shapes, 5 entity kinds + factories,
  type-only import machinery (incl. the `type: 'interface'` concise-form
  sharp edge), List/FunctionParameter/toPathTemplate, sanitizeIdentifier vs
  sanitizePropertyName, TsFile render rules, gen-zod worked example with a
  wrong-vs-right contrast, string-leaf legitimacy rules, TS pitfall table.
  Section headings are the template for other lang skills.
- **A4 ✅ `skmtc-lang-kotlin-v3/SKILL.md`.** Same headings as A3. Carries
  carry: head+value render model; 7 entity kinds; packages-from-paths
  (`toPackageName`, throwing validation); symbol-level imports, sorted,
  same-package suppression, no type-only imports, no re-exports;
  KtAnnotation (current object-args API, self-registering), KtParameterList,
  KtPrimaryConstructor, KtFunctionSignature; `sanitizePropertyName`
  backtick/throw semantics + the @SerialName composition rule; the
  mirrored-protocols gotcha (KtAnnotated/KtDocumented read off the
  projection wrapper); module-init-cycle hazard; projection vs accumulator
  shapes (kotlinx vs spring); the version-drift warning.
- **A5 🚧 Consistency pass.** Export-name grep PASSED 2026-07-31 (every
  API name cited in the three skills exists in lang-typescript /
  lang-kotlin / core source; zero missing). Remaining: confirm frontmatter
  loads in a fresh session; optional human read-through.
- **A6 ⏳ Index/registration.** Whatever the repo's skill index requires
  (README listing, CLAUDE.md pointers) so agents discover v3 alongside v2.
  Decide the v2 → v3 transition story (recommend: run both, compare via
  Workstream C, retire v2 on a won comparison).

- **A7 ✅ `skmtc-model-v3` (shape axis, 2026-08-03).** The experiments'
  hierarchy (constraint > context > instruction) applied to skill
  design: a third skill axis — generator SHAPE — whose deliverable is a
  fill-in SKELETON, not prose. The skill ships a complete, compiling,
  engine-tested TS model-generator package (gen-zod's ref/recursion
  machinery, visibility capture, 12 SLOT markers, placeholder target
  syntax) plus ~150 lines of method + edge-case canon; authoring
  becomes copy → rename → fill slots → re-pin the shipped
  toArtifacts test. Rationale: in exemplar-poor conditions the
  skeleton IS the exemplar — instruction demonstrably failed there
  (EXP-3b/3c), constraint won (EXP-4c). generator-v3/lang-ts-v3 now
  point at it (0.2.2); no dedup cuts were needed (v0.2.0 had already
  deleted the model worked-example). Eval = EXP-5 (CHECKLIST), Opus
  tier by user decision; operation/accumulator shape skill is the
  sequel if EXP-5 confirms.

### The string-trap strategy (decision record)

Approaches evaluated: (A) prohibition — rejected as primary (leaky and
wrong: strings are legitimate leaves); (B) conceptual reframe — *text does
not exist during generate* — **adopted as the spine**; (C) decision
procedure at the keystroke (the punctuation litmus) — **adopted**;
(D) worked examples dominate, incl. one marked wrong-vs-right contrast with
its failure signature — **adopted**; (E) feedback-loop inversion via
tooling — **adopted, Workstream B**; (F) mechanical detection — **adopted**:
the lint plugin already exists, skills cite it, tools extend it;
(G) structural on-ramp (mental model before API, recipes last) —
**adopted as skill structure**. The law as worded in the skills: *strings
are for names and literal values; structure is for syntax; if you are
typing target-language punctuation into a string that will be stored on an
object, stop.*

## 2. Workstream B — agent-facing tools

Unifying frame: **reorientation tools** — after each change the agent
checks what the engine actually did, at the granularity it works at (one
subject, one projection). All tools speak the skills' vocabulary
(register/insert, projection, snippet, ref hit/miss) so tool output
reinforces the mental model. Build harness-agnostic: plain functions with
JSON in/out, wrapped as CLI first (Claude Code + skills), Pi extension /
Flue `useTool()` later.

Existing substrate (verified this session — build on, don't duplicate):
- `skmtc generate <project> --debug` capture: `{artifacts, inspection,
  sidecars}` — full rendered source + structured tree per file, every
  definition carrying its generatorKey. (The animation demo is built
  entirely from this.)
- `@skmtc/lint-plugin`: `no-template-imports`, `no-adhoc-tostring`.
- `@skmtc/gen-eval` (`skmtc/packages/gen-eval`): mechanical AST checks —
  package structure, producer share, method discipline, **string
  composition inside/outside `toString()`** (check 4), top-level
  projection, accumulator detection.

Build order:

- **B1 ⏳ `inspect-subject`.** Given (generator, subject): the projection's
  object tree (inspection view), rendered text, imports declared,
  definitions registered (identifier + exportPath + file). Mostly a
  presentation layer over the `--debug` capture. **Scope correction
  (2026-07-31 confidence review): per-lookup cache hit/miss is NOT in the
  capture** — only coarse derivations (a definition existing once with N
  referencing files); true ref-hit/miss reporting belongs to B3's trace.
  Gate: an agent can answer "what did my generator just do for subject X?"
  from one command.
- **B2 ⏳ String-trap lint, extended.** The two existing rules + new:
  template literals containing target-language punctuation stored on
  fields; inline string names shadowing cache identifiers ("you wrote
  'JsrPushStatus' — reference the definition"). Doubles as eval metric (C).
- **B3 ⏳ Trace debugger.** The event stream (generator-start/done,
  subject-enter/done, projection-open + parent, snippet-add, ref-hit/miss,
  register, import-add) exposed as a filterable tool. Two paths, both
  designed in the animation-verification session: a wrap-harness that
  instruments the generator stack from outside core (the harness owns the
  transforms/classes it passes in — no engine change), or the parked M5
  `trace?: (event) => void` sink in core. Start with the wrap-harness; it
  also delivers the animation's Tier-1 verification. **Feasibility wrinkle
  (2026-07-31): bundled generators resolve through the CLI's config map,
  so wrapping requires a custom `toArtifacts` runner assembling its own
  `toGeneratorConfigMap` — unproven. First sub-step is a spike proving
  that seam before building the event vocabulary.** Gate: machine trace of
  the demo slice reproduces the hand-authored ordering.
- **B4 ⏳ Golden diff.** Before/after an edit: diff manifest-level facts
  (files, definitions, identifiers, imports, cache hit/miss counts), not
  just artifact text. Answers "what did my change actually do?"
- **B5 ⏳ `explain-ref`.** Given an identifier (+ optional consumer):
  which projection claims it, computed exportPath, hit-or-miss from here,
  what a miss would construct. Targets coordination-by-memoization, the
  second-hardest concept.
- **B6 💡 MCP wrapper** — only if/when a hosted context needs it.

## 3. Workstream C — evaluation of skills + tools

### C-EXP 🚧 The feedback-inversion experiment (PRIORITIZED 2026-07-31)

Before building the B tools in full, test the hypothesis they rest on:
*observability of the object-tree path, not just instruction, is what
reduces the string-concatenation trap.* Feasible quickly because the two
expensive prerequisites exist: `@skmtc/gen-eval` was built to grade
model-authored generators (check 4 = string composition inside/outside
`toString()` — a mechanical trap metric), and the `--debug` capture is the
proto-tool substrate. The experiment is a pulled-forward vertical slice of
C0/C1/C2a — nothing is throwaway.

Two separable claims: (1) v3 skills alone reduce the trap vs no skill;
(2) the observability loop on top of the skills reduces it further. The
isolating comparison for (2) is skills-only vs skills+proto-tools: the
generator-v3 skill's §10 already instructs verification with today's
primitives, so the tools arm changes only the lens quality, not the
instruction to look. Keep loop-instruction wording near-identical across
arms (only the commands differ).

Stages (kill-criterion first):
- **Stage 0** (~half day): task fixture (small schema + "author a TypeBox
  generator" — gen-zod-shaped, novel target library, trap fires in the new
  snippet classes; **name a backup task with a more distant target library
  (e.g. effect/Schema) in case TypeBox proves too zod-adjacent to pressure
  the trap**); scoring script (gen-eval + lint + `deno check` +
  duplicate-definition check); proto-B1 (~100-line pretty-printer over the
  `--debug` inspection, filtered to one subject — **ground-truth it first
  against the existing animation-demo capture to fix what it can actually
  show; no hit/miss claims, see B1 scope correction**). Runs happen in a
  **standalone scratch workspace** per session — arm control requires the
  v3 skills not be auto-discoverable in the no-skill arm.
- **Stage 1** (3 baseline runs, no skill/no tools): does the trap fire at
  all with current models? Watch one run for task-difficulty calibration
  against pre-stated criteria: *too easy* = clone of gen-zod nearly
  compiles unmodified; *too hard* = failures dominated by non-trap causes
  (schema parsing, Deno setup). Either → swap to the backup task before
  the remaining runs; a "trap absent" verdict counts only from a
  calibrated task.
- **Stage 2** (3–5 runs per arm): skills-only vs skills+proto-tools.
  Metrics: check-4 outside-share, lint firings, compile, unresolved
  imports, duplicate definitions, and the process signal *was the first
  code projection-shaped or string-shaped?* (the most direct read on
  whether the prior was replaced or merely corrected later).

Decision rule (stated before running):

| Result | Action |
|---|---|
| Trap absent at baseline | Premise re-examined; tools re-justify on debugging value; skills still validated via Stage 2 B-arm quality |
| Skills+tools ≫ skills-only on trap metrics | Feedback inversion confirmed → B1/B2 built properly, first in B |
| Both arms clean | Skills suffice for the trap; tools re-prioritized around D1 debugging needs |
| Skills-only still traps | Skill §2 not landing → skill revision before tool investment |

Caveat: 3–5 runs per arm is a directional signal, not statistics — the
decision needs "visibly large effect", not p-values.

**Run-1 finding and the exemplar-access fork (2026-07-31).** Baseline
run 1 passed every metric with gen-eval verdict "clean" — by FETCHING the
published @skmtc/gen-zod from JSR and imitating its architecture
(self-reported in its summary). The trap did not fire; the mechanism was
imitation of real stock source, not the skills' teaching. Implication:
published stock generators are an uncontrolled teaching channel open to
every arm, and a strong model with exemplar access solves gen-zod-shaped
tasks by imitation. This does NOT invalidate the experiment — it sharpens
what it measures. Two conditions now distinguished:
- **Exemplar-rich** (current setup): stock generators reachable. Realistic
  for real usage; measures the *marginal* value of skills/tools over
  imitation (speed, token cost, correctness at the edges).
- **Exemplar-poor**: a task shape with no close stock exemplar (e.g.
  accumulator-shaped or operation-side target, where the historical
  failures clustered, or a lang with thin stock coverage) — measures
  skills/tools where imitation cannot carry the agent. This is also the
  authentic condition of the D-workstream use case (novel requirement,
  e.g. "Spring Boot with a serialization lib no stock generator uses").
Runs 2–3 complete the exemplar-rich baseline for variance; the
exemplar-poor task design is the follow-on decision after EXP-1.

**EXP-1/1b VERDICT (2026-07-31, 6 runs: 3 Fable + 3 Sonnet).** Trap absent
at both tiers, 6/6 all-green, every run exemplar-driven (fetched published
gen-zod from jsr.io before writing code). Tier inversion held 3/3: Sonnet's
outsideShare 0.080–0.192 beat all Fable runs (0.30–0.46) — heavier
imitation inherits the exemplar's discipline; frontier capability buys
improvisation drift. Cost is exploration-driven, not tier-driven (Sonnet
$2.89–4.49 over 60–91 turns ≈ Fable $4.05–4.94 over 32–46). Consequences:
in the exemplar-rich condition the skills' testable value is the
exploration tax (turns/cost/latency) and discipline consistency, not
correctness; the trap question moves entirely to the exemplar-poor
condition. EXP-2, if run as designed, should be scored on cost/turn/
outsideShare deltas; the exemplar-poor task (accumulator-shaped, no stock
exemplar — the D-workstream scenario) is the sharper instrument for the
original hypothesis.

**EXP-2 VERDICT (2026-07-31; Fable skills trio complete, Sonnet trio
skipped by user).** Skills arm vs Fable baselines: outsideShare
0.230–0.266 vs 0.30–0.46 (better on every run, variance collapsed —
the discipline effect is real but modest, still ~3× the reference);
gen-zod source study collapsed across runs (13→4→2 refs — the skills DO
substitute for the exemplar safari); but cost rose to $4.59/$7.59/$7.73
over 46–64 turns vs $4.05–4.94 over 32–46 — the exploration tax was
replaced by a larger skill-following tax. **Net: in the exemplar-rich
condition at the frontier tier, v3 buys consistent moderate discipline
at ~+60% cost, with correctness saturated either way.** Actionable
consequences: (a) compress the skills — their length is priced into
every run; (b) lead the authoring recipes with "clone the nearest stock
generator" so the skill channels the empirically-winning imitation
strategy instead of competing with it; (c) the skills' decisive test
remains the exemplar-poor condition, where imitation has nothing to
imitate. Tools arm deferred until after the skill redesign.

**EXP-2c VERDICT (2026-07-31; v0.2.0 redesign + tools arm, 3 Fable
runs).** The redesign (commit 7ae8f78d: 55% compression + clone-first
lead) plus the proto inspector produced the best condition on every
measured axis: outsideShare 0.077–0.130 (tools-2 at the reference;
~3× better than baseline, ~2× better than v0.1.0 skills), cost
$3.83–4.17 (below every other Fable run), 40–41 turns at 268–310s
(baseline pace with skills + inspector aboard). Behavior: both skills
loaded; the inspector executed ONCE per run, at the END, as a final
confirmation rather than a mid-loop reorientation step (correction:
earlier count of 4–6 was stream mentions, not executions); gen-zod
still consulted (13–15 refs) — imitation channeled, not suppressed.
Attribution implication: the metric gains are mostly the redesign's;
the inspector's reorientation value went untested here because nothing
went wrong — its test is the exemplar-poor/debugging condition.
Redesign-vs-inspector attribution remains confounded (separable with a
v0.2.0-skills-only trio); the shipped package dominates regardless.
**The feedback-inversion thesis survives in revised form: observability
plus compressed principles beats either alone — but only after the
skill stopped competing with imitation.** Remaining open: the
exemplar-poor condition, and a Sonnet pass on v0.2.0 if tier economics
matter.

**EXP-3b VERDICT (2026-07-31; exemplar-poor baseline trio, task2).**
**The trap fired 3/3** — in its refined, discipline form. All functional
gates passed on every run (accumulator shape, zero duplicates,
zod-via-engine with stitched imports, lint clean: the machinery's
contract is discoverable without exemplars), but outsideShare hit
0.981 / 0.945 / 1.000 against the task anchor 0.180 — composition
reverted wholesale to string helpers the moment there was nothing to
clone. gen-eval verdict "fail" ×3. Run 3 is the cautionary exhibit: the
fully-string run was also the fastest and cheapest (28 turns, $4.62) —
the string path is LOCALLY cheaper, which is exactly why it is a trap
(the cost lands later, on whoever builds on the output). Combined with
task 1: imitation was doing nearly all disciplinary work in
exemplar-rich conditions (0.30–0.46 with gen-zod visible → ~1.0
without). Calibration confirmed: the task is not too hard (3/3
functional pass); the instrument separates cleanly. EXP-3c (tools trio
on v0.2.1) is the decisive comparison, in flight. EXP-4 (one-shot,
below) authorized by user.

**EXP-4 (user-directed): the one-shot arm.** Tests the under-a-minute
architecture's load-bearing unknown — first-pass green rate with fully
pre-assembled context, no agentic loop. Deterministic context assembly
(skills v0.2.1 + task + fixture + nearest partial exemplars from the
clone table) → ONE no-tools generation call emitting all files → files
written programmatically into a warm workspace → programmatic verify →
at most one error-fed repair call → score2. Metrics: wall time, cost,
first-pass green rate, outsideShare vs the 0.180 anchor.

### The full battery

- **C1 ⏳ Benchmark battery** (fresh session per run; compare v3 vs v2 vs
  no-skill):
  - T1 clone a stock generator, add a field-type mapping
  - T2 author a small TS model generator from scratch
  - T3 the same generator in Kotlin (tests the lang-skill split)
  - T4 operation generator consuming another generator's models (the
    concept string concatenation silently destroys)
  - T5 add an enrichment seam, honor it in identity + body
  - T6 change an export-path policy without breaking cross-generator refs
- **C2 ⏳ Metrics.** Outcomes: artifacts compile; expected identifiers at
  expected exportPaths; zero unresolved imports; cross-generator refs are
  cache hits (no duplicates); **string-trap lint firings = 0** (the direct
  measurement of the failure v3 exists to prevent — if v3 doesn't move it,
  revisit the approach). Process: did the agent run the tools; edit-revert
  cycles; time/tokens to first correct render; first-code-was-projections
  vs first-code-was-strings. gen-eval grades the authored package.
- **C3 ⏳ Concept quiz.** ~15 engine-truth questions ("what does
  toString() return during generate?", "two generators register the same
  name at different exportPaths — collision?", "when is a projection's name
  computed?"). Minutes to run, pinpoints which skill section failed to
  teach. Doubles as the skills' regression suite on engine changes.
- **C4 ⏳ Scorecard + loop.** Results pinned to (skill version × engine
  version × task). Failures and quiz misses become friction entries in the
  existing retro pipeline; retro review clusters them into skill edits;
  re-run the battery after each edit.

## 4. Workstream D — the authoring harness (Pi/Flue) 💡

Reviewed 2026-07-31: **Pi** (pi.dev, Earendil) — minimal TS agent harness;
extensions, skills, TUI/JSON-RPC/SDK modes. **Flue** (flueframework.com,
Anthropic, powered by Pi) — durable agents as TS functions (`'use agent'`,
`useModel`/`useSkill`/`useTool`), persistent resumable sessions, sandboxes,
deploys via Vite+Hono to Node/CF Workers. Caveat: Flue's deep doc pages for
tools/sandboxes 404'd; confirm the tool-definition API before D2.

Target experience (**exemplar-anchored generator synthesis**): user brings
an OpenAPI schema + a codegen requirement (e.g. "Spring Boot server with my
serialization library"), maybe a code sample. Phases, harness-enforced:

1. **Intake** — parse schema, inventory subjects, surface parse issues.
2. **Exemplar** — acquire the golden sample (user's code > web-searched
   reference adapted to their schema > agent-drafted) for ONE operation +
   ONE model; user sign-off. The exemplar is the contract — and it defuses
   the string trap by giving "write the target code as text" its own
   legitimate phase, so authoring becomes *lifting* the exemplar into
   projections, not writing strings.
3. **Decompose** — annotate exemplar spans: identifier-derived,
   schema-derived (→ router), static scaffolding, shared definitions (→
   cache). Output = the generator's spec.
4. **Scaffold** — clone the nearest stock generator (seam catalog ranks
   candidates; serialization swap = the router + annotation seam).
5. **Author** — skills-guided, constrained action space (edits only inside
   the generator package + the B-tools; no free-form output writing).
6. **Verify** — engine run (sub-second), AST-aware exemplar diff for the
   golden subject, sandbox compile, full-schema sweep, gen-eval green.
7. **Deliver** — publish generator + generated app; the user keeps the
   generator, so the deal survives schema evolution.

Milestones:
- **D1 ⏳ Manual validation in Claude Code** — run the whole loop with the
  v3 skills + B1/B2 as CLI tools on one real case (the Spring Boot +
  serialization-lib scenario; gen-kotlin-spring as clone base). Every
  lesson feeds A/B.
- **D2 💡 Flue agent** — durable session per engagement, phases in agent
  state, B-tools as `useTool`, sandboxed compiles, CF Workers deploy
  alongside skmtc-platform. Pi remains the local power-user surface.
- **D3 💡 Exemplar sourcing** — web-search + rank + adapt pipeline, with
  provenance recorded; exemplar committed as a test fixture ("golden
  subject") in the produced generator.

## 5. Sequence

**Hardening mini-phase (≤ half day, next)**: H1 compile-verify the Kotlin
skill's worked example through the real engine and correct the skill from
the output (the example is currently synthesized against lang-kotlin HEAD
with no shipped generator exercising that API — the suite's weakest
concrete artifact); H2 = A5b fresh-session load check; H3 ground-truth
proto-B1 against the animation-demo capture.

Then: A6 (skills registered) → **C-EXP Stages 0–2 (the prioritized
feedback-inversion experiment; its outcome sets B's build order)** → B1+B2
per the decision table → C1–C3 first full run (baseline v3 vs v2) → D1
(manual harness validation) → iterate skills from C/D findings → B3–B5 →
D2/D3 when the workflow has proven out. The C-EXP harness (scratch-
workspace runner, arm matrix, scoring script, task fixture) carries
forward as C0/T2/C2a.

## 6. Open questions

- Flue `useTool`/sandbox API details (docs 404'd) — confirm before D2.
- Skill distribution: do v3 skills ship to agents outside this repo (CLI
  `agent-context`? hub?) and does that change format constraints?
- v2 retirement criteria: which C-battery margin justifies replacing v2?
- B3: wrap-harness first is decided; when engine work next opens, revisit
  un-parking M5 (the trace sink) so the harness's fragile patching can be
  retired — the animation demo's PLAN.md M5 section holds the verified
  instrumentation points.
- Kotlin generators' API drift (KtAnnotation etc.): file as an issue to
  migrate `skmtc-generators/gen-kotlin-*` to lang-kotlin HEAD, or the v3
  Kotlin skill's examples will diverge from the only shipped Kotlin code.
- **Post-hoc v2 lesson harvest (USER DECISION NEEDED).** The from-scratch
  constraint served its purpose (independent authorship) but had a cost:
  retro-pipeline lessons encoded in the v2 skills were not inherited, so
  v3 may re-lose ground v2 had won. Now that v3 is written, a diff pass
  reading v2 to harvest missed lessons would be cheap — but it
  contradicts the original "do not read existing skills" instruction, so
  it needs explicit approval. Alternative: let the C-battery comparison
  surface the gaps empirically (slower, unbiased).

## 7. Confidence register (2026-07-31 review)

Recorded so future sessions know what is load-bearing vs provisional.

- **High**: engine semantics in generator-v3 (triple-confirmed: two
  independent source sweeps + the animation project's verified encoding);
  the string-trap diagnosis (gen-eval check 4 and the lint rules are the
  fossil record of the real failure).
- **Medium-high**: lang-typescript skill (thorough verbatim-quoting sweep,
  but single-source and mostly not personally read); experiment design
  (isolation logic sound; task calibration is the watch item); B1
  substrate (capture verified firsthand — after the hit/miss scope
  correction above).
- **Medium → medium-high after H1 (2026-07-31)**: lang-kotlin skill — the
  worked example now compiles byte-for-byte through the real engine
  (`lang-kotlin/src/skill-v3-example.test.ts`, kept as the skill's
  regression gate; zero corrections were needed). Remaining medium: skill
  pedagogy overall — untested with fresh agents, density risk, and the
  v2-lesson gap above.
- **Low / by-design unknown**: treatment efficacy of the anti-trap
  strategy (that is what C-EXP tests); the Pi/Flue layer and the whole
  exemplar-anchored D design (two doc-page fetches, one 404, all
  reasoning untested — the "exemplar phase defuses the trap" claim is
  plausible psychology with zero evidence); B3 wrap-harness seam
  (spike before build).
