# Learnings — v3 skill authoring + the feedback-inversion experiments

Session date: 2026-07-31. Companion to `../PLAN.md` (rationale + decisions)
and `../CHECKLIST.md` (execution state) — those are the live documents;
this file is the durable analysis: what was learned, with evidence, for
future agents and human readers. EXP-2 (skills arm, 6 runs) was IN FLIGHT
when this was written; its results land in PLAN/CHECKLIST.

## 1. What this session produced

- Three from-scratch skills (`skmtc-generator-v3`,
  `skmtc-lang-typescript-v3`, `skmtc-lang-kotlin-v3`) in
  `deno/docs/skills/`, grounded in three parallel source sweeps of
  @skmtc/core@0.28.3, lang-typescript@0.12.17, lang-kotlin HEAD, and five
  stock generators — authored without reading any prior skill (user
  constraint), registered in the ecosystem README, symlinked into
  discovery. Branch `docs/skills-v3-generator-authoring`, 3 commits.
- A compile-verified worked example pinned as a permanent doc-sync test:
  `deno/lang-kotlin/src/skill-v3-example.test.ts` (the skill's Kotlin
  data-class example, byte-for-byte through the real engine — passed
  first run, zero corrections needed).
- The complete experiment rig under `../exp/`: fixture, JSR-pinned
  workspace template, real-pipeline harness, scorer (gen-eval + lint +
  typecheck + dedup), arm runner with skill isolation, hidden reference
  solution, proto-inspect-subject tool.
- Twelve experiment runs designed; six baseline runs completed and
  analyzed (below); six skills-arm runs launched.

## 2. Experiment results — baselines (EXP-1 / EXP-1b, complete)

Task: author `@exp/gen-typebox`, an SKMTC model generator emitting
TypeBox schemas for a 4-model fixture (enum model, array-of-ref, shared
ref ×2, optional, nullable). Baseline arm: NO skmtc skills discoverable,
no tools, only "run `deno task verify` after each change". Reference
solution (hand-written, v3-style): all checks pass, outsideShare 0.07.

| Run | Model | All checks | gen-eval verdict | outsideShare | Cost | Turns | Wall |
|---|---|---|---|---|---|---|---|
| base-1 | Fable | PASS | clean | 0.299 | ~$4 (est) | ~31 | — |
| base-2 | Fable | PASS | clean | 0.465 | $4.05 | 32 | 270s |
| base-3 | Fable | PASS | clean | 0.464 | $4.94 | 46 | 358s |
| sonnet-base-1 | Sonnet | PASS | clean | 0.185 | $4.49 | 91 | 648s |
| sonnet-base-2 | Sonnet | PASS | clean | 0.080 | $2.89 | 60 | 678s |
| sonnet-base-3 | Sonnet | PASS | clean | 0.192 | $3.94 | 88 | 708s |

(outsideShare = gen-eval check 4: share of string composition living
outside `toString()` bodies / naming statics — the mechanical trap
metric. base-1 cost estimated: it ran before stream-json capture.)

## 3. Findings, with the evidence

### F1. The string-concatenation trap did not fire — 6/6, both tiers

Every run produced a projection/snippet-shaped generator (producerShare
1.0, zero `skmtc/no-template-imports` or `no-adhoc-tostring` firings,
zero duplicate definitions, correct Driver-stitched imports). No run
produced a string-first draft at any point (verified in the stream-json
event order for 5/6 runs; base-1 self-reported).

### F2. The mechanism: exemplar acquisition from the public registry

Every run independently discovered the same strategy before writing any
code: fetch the published `@skmtc/gen-zod` source from jsr.io (several
also pulled core's `ModelDriver` and lang-typescript's projection-base
files) and author by informed imitation. base-2's tool-call sequence is
archived and canonical: deno-cache hunt → `deno doc jsr:@skmtc/core` →
curl of lang-ts + core + full gen-zod source → one-burst package write →
verify PASS. **Published stock generators are an uncontrolled teaching
channel available to any arm.** The experiment's own workspace deno.json
(naming the @skmtc scope) is what provides the scent.

Consequence: the original trap hypothesis is now scoped to the
**exemplar-poor condition** (a task with no close stock analogue — which
is also the authentic condition of the agentic-authoring use case:
"Spring Boot with a serialization library no stock generator uses").
The historical failures that motivated v3 plausibly occurred with weaker
models, no exemplar access, or non-model-generator task shapes.

### F3. The tier inversion: Sonnet out-disciplined Fable, 3/3

Every Sonnet run beat every Fable run on outsideShare (0.080–0.192 vs
0.299–0.465); sonnet-base-2 matched the hand-written reference (0.080 vs
0.07). Mechanism, visible in the streams: Sonnet touched gen-zod source
~49–50 times per run vs Fable's ~14 — the weaker model imitates the
exemplar more faithfully and inherits its discipline; the frontier model
skims, "gets the idea", and improvises its own string-composing helpers.
**Capability buys confidence; confidence buys deviation from the taught
pattern.** Two implications: (a) the v3 litmus rule's audience includes —
maybe especially — frontier models; (b) the "worked examples dominate
instruction" thesis the skills are built on was confirmed by accident:
the run that copied hardest scored best with no instruction at all.

### F4. Cost is exploration-driven, not tier-driven

Sonnet's cheaper tokens were spent on 2–3× the turns (60–91 vs 32–46)
and ~2× the wall time, landing in the same $3–5 band as Fable. The
dominant spend in every run is re-deriving the mental model from fetched
source — the thing a ~15k-token skill carries pre-distilled. This makes
"skills cut the exploration tax" the primary quantitative hypothesis for
EXP-2, ahead of correctness (already saturated in this condition).

### F5. What remains measurably imperfect even in all-green runs

The only graded gradient separating baselines from the reference was
outsideShare (discipline drift), plus turn count / cost / latency. Design
note for future evals: when correctness saturates, these margins are
where instrument sensitivity must live — build metrics for them first.

## 4. Infrastructure learnings (hard-won, reusable)

### Running headless Claude Code experiments

- `claude -p` takes the prompt via **stdin** (a positional prompt after
  flags mis-parses); plain output captures ONLY the final message. For
  process metrics use `--verbose --output-format stream-json` — every
  tool call, and the final `result` event carries `total_cost_usd`,
  `num_turns`, `duration_ms`, `modelUsage`. (The result event is not
  always the literal last line — search for `total_cost_usd`.)
- Headless runs inherit the invoking user's **default model** — our
  baselines silently ran on claude-fable-5 at ~$4.50/run until noticed.
  Always pin `--model` explicitly in experiment runners; model tier is an
  arm dimension.
- **CLAUDE_CONFIG_DIR isolation fails on auth**: a fresh config dir can't
  refresh OAuth ("session expired and could not be refreshed"), and
  copying credentials risks refresh-token rotation logging out the real
  session. Do not attempt. Arm isolation instead by **symlink shuffle**
  in `~/.claude/skills/` (park + restore with an exit trap) — which
  forces runs to be SEQUENTIAL, since the shuffle is global user state.
- Skill discovery on this machine = symlinks in `~/.claude/skills/` →
  repo skill dirs. New-machine setup must recreate them. The listing
  refreshes live mid-session when links change.
- Run workspaces must live OUTSIDE the repo tree or project CLAUDE.md /
  memory context leaks into arms.
- Never edit a bash script while an instance of it is running (bash
  reads incrementally; offsets shift) — queue the edit.

### The SKMTC engine as a test rig

- `toArtifacts` (sync, from @skmtc/core) runs the full parse→generate→
  render pipeline in-process: pass `{type:'oas', value: <OpenAPI doc>}`,
  `toGeneratorConfigMap: () => ({[entry.id]: entry})`,
  `StackTrail.empty()`, `silent: true`. `inspect: true` adds the
  depth-bounded inspection snapshot ({artifacts, inspection} — same
  shape the CLI's `--debug` capture uses).
- `manifest.results` is a NESTED tree (phase → generator → subject →
  variant) with status-string leaves — count leaves, don't stringify
  values.
- Artifact keys keep the `@/` root marker (e.g.
  `@/models/Order.generated.ts`); map `"@/": "./out/"` in a separate
  check config to typecheck rendered output in place.
- Resolving `@skmtc/*` from **public jsr.io works** for core 0.28.3,
  lang-typescript 0.12.17, lint-plugin 0.1.0 — and JSR packages carry
  their own dependency resolution, so a consumer workspace needs no
  transitive import-map entries (unlike path-based imports, where core's
  343 internal `@/` imports force a `"@/": <core-dir>` mapping).
- `deno lint --json` exits non-zero when findings exist — capture stdout
  from the thrown error, then parse.
- `@skmtc/gen-eval` CLI: `node src/cli.ts <genDir> --json out.json`.
  Report fields worth extracting: `structure.pass`, `producerShare`,
  `strings.outsideShare` + `topOutsideSites`, `templateImports.pass`,
  `adHocToString.pass`, `methodDiscipline`, `aggregate.verdict`.
- The `--debug`/inspect capture does NOT record per-lookup cache
  hit/miss (only end-state definitions), and below its depth bound
  leaves serialize as opaque strings (`"[ZodString …]"`). Per-event data
  needs the trace (B3); a real inspect-subject tool must handle the
  depth bound.

### Skill authoring pipeline

- Three parallel read-only source sweeps with mandatory file:line
  citations produced skill content accurate enough that the Kotlin
  worked example — synthesized against an API no shipped generator even
  uses — compiled byte-for-byte on the first engine run. The pipeline
  (sweep → write from citations → compile-verify example → grep-verify
  every named export → fresh-session load check) is repeatable and cheap.
- Pin worked examples as engine tests in the lang package
  (`skill-v3-example.test.ts` pattern): doc-drift then fails in CI
  before the skill silently rots.
- Skills should cite stable API names, never file:line (line numbers rot
  silently; names fail loudly).
- The shipped `skmtc-generators/gen-kotlin-*` packages are API-stale vs
  lang-kotlin HEAD (positional `KtAnnotation`, dissolved `KtSupertyped`;
  the 0.9.11 flattening). Any consumer of those sources must copy their
  STRUCTURE, not their lang-API call shapes. Migration issue pending.

## 5. Where everything lives

| Artifact | Path |
|---|---|
| Live plan (workstreams, decisions, verdicts) | `notes/skills-tools/PLAN.md` |
| Execution checklist | `notes/skills-tools/CHECKLIST.md` |
| The three skills | `deno/docs/skills/skmtc-{generator,lang-typescript,lang-kotlin}-v3/` |
| Kotlin example regression test | `deno/lang-kotlin/src/skill-v3-example.test.ts` |
| Experiment rig | `notes/skills-tools/exp/` (fixture, template, smoke reference, score.mjs, run.sh) |
| Run archives (workspace + stream + score per run) | `notes/skills-tools/exp/results/<run-id>/` |
| Proto inspect-subject tool | `notes/skills-tools/proto-inspect-subject.mjs` |
| Work branch | `docs/skills-v3-generator-authoring` (skmtc repo) |

## 6. Open threads at time of writing

- EXP-2 skills arm (3 Fable + 3 Sonnet) in flight — primary metrics:
  turns/cost/outsideShare deltas vs the baselines above, and whether
  skills-arm agents still fetch gen-zod (skill-as-supplement) or not
  (skill-as-substitute).
- Exemplar-poor task design (accumulator-shaped, no stock analogue) —
  the sharper instrument for the original trap hypothesis and the
  authentic D-workstream condition.
- v2-skill lesson harvest: deferred by user; requires explicit approval
  (original constraint was authored-without-reading-v2).
- B3 trace wrap-harness feasibility spike; B1 built properly against the
  depth-bound finding; Kotlin generators' HEAD migration issue.

## 7. Addendum (same day): EXP-2 results and the v0.2.0 redesign

Full Fable-tier comparison (reference solution: outsideShare 0.07):

| Condition | outsideShare | Cost | Turns | Wall |
|---|---|---|---|---|
| baseline ×3 | 0.30 / 0.46 / 0.46 | $4.05–4.94 | 32–46 | 4.5–6 min |
| v0.1.0 skills ×3 | 0.235 / 0.230 / 0.266 | $4.59–7.73 | 46–64 | 5.2–9 min |
| v0.2.0 skills + inspector ×3 | **0.130 / 0.077 / 0.120** | **$3.83–4.17** | 40–41 | 4.5–5.2 min |

(Sonnet skills trio skipped by user decision after the Fable trio.)

### F6. v0.1.0 skills: real discipline gain, negative economics

All three v0.1.0 skills runs beat all three baselines on discipline
(variance collapsed too) and the skills DID displace the gen-zod safari
(refs 13→4→2 across runs) — but cost rose ~60% with more turns: the
skill-following tax exceeded the exploration tax it replaced. Lesson:
**skill length is priced into every turn of every run; a skill competes
for the same budget as the exploration it prevents.**

### F7. The v0.2.0 redesign + inspector dominated every axis

Redesign (1116→499 lines, clone-first table leading the generator
skill, litmus + engine-rules kept, worked examples delegated to the
cloned exemplar) plus the proto inspector produced: near-reference
discipline (one run AT reference), the cheapest Fable runs of the whole
experiment, and baseline pace despite carrying skills + an extra
inspection step per verify cycle. Agents loaded both skills and consulted gen-zod (13–15 refs —
imitation channeled rather than suppressed), but executed the
inspector only ONCE per run, at the end, as a final confirmation
(correction: an earlier count of 4–6 was stream mentions, not
executions). Reorientation tools earn their keep when something is
wrong; in all-green runs there was nothing to reorient from — the
inspector's real test is the exemplar-poor / debugging condition. Attribution between the
redesign and the inspector is confounded (a v0.2.0-skills-only trio
would separate them); the shipped package wins outright regardless.

### The arc, in one paragraph

Teach-from-first-principles skills (v0.1.0) fought the empirically
winning strategy (imitation of published exemplars) and lost on
economics while winning modestly on discipline. Rewriting the skills to
*channel* imitation (clone-first) and *compress* to just the
non-imitable engine rules + the litmus, then adding observability (the
inspector), beat every other condition on every axis. The
feedback-inversion thesis survives in revised form: **observability +
compressed principles + sanctioned imitation** is the winning bundle in
the exemplar-rich condition. The exemplar-poor condition (no stock
analogue to imitate — the agentic-harness scenario) remains the open
test, where the balance may shift back toward richer teaching.

## 8. Second addendum (same day): exemplar-poor design, external review, method pitfalls

### F8. Reorientation tools go unused when nothing goes wrong

Stream forensics on the tools arm corrected an earlier overstatement:
agents executed the inspector ONCE per run, at the very end, as a final
confirmation — never mid-loop. Not a tool failure: verify went green
early, so there was no model-vs-engine divergence to reorient from. The
tools arm therefore validated the inspector's COST (zero — fastest,
cheapest runs) but not its BENEFIT. A reorientation tool's value test
requires runs where first attempts are wrong — the exemplar-poor /
debugging condition, not the happy path.

**Method pitfall (own goal):** counting substring mentions in a
stream-json transcript overstates tool usage badly (prompt echoes, file
reads, and instructions all match). Count `tool_use` events with the
command filter, never raw line matches. The wrong count made it into
three documents before forensics caught it.

### F9. "Exemplar-poor" is about combinations, not absence

You cannot hide the registry from an agent, so exemplar-poor cannot mean
"no source to fetch." The workable definition: **no single exemplar
covers the combination**. Task 2 (`@exp/gen-api-client`) composes three
shapes that each exist separately on JSR — operation subjects
(gen-tanstack), accumulator-per-tag (gen-express), cross-generator
consumption of gen-zod (gen-tanstack, different structure) — into a
target nothing exhibits: per-tag client classes with methods accumulated
across operations and responses parsed by engine-materialized zod
schemas. Clone-first exhausts at "pieces"; synthesis must come from the
rules layer.

**Anchor shift:** the task-2 reference scores outsideShare 0.180 vs
task-1's 0.07 — client method bodies are legitimately string-heavier
than schema combinators. The trap metric's baseline is
TASK-MORPHOLOGY-DEPENDENT; never compare across tasks without
re-anchoring on a reference solution. (This is why every task needs a
hidden reference implementation before any arm runs.)

### F10. The external-review harvest, and how to triage one

A user-commissioned v2-vs-v3 evaluation (the deferred "v2 lesson
harvest", delivered externally) produced two verified accuracy bugs and
a port list. The triage framework that emerged, priced by our own cost
data:

- **Fix unconditionally**: verified factual errors. Both bugs
  (insertModel returns an Inserted handle, not the definition;
  defineAndRegister is lang-package — context version deleted) were
  confirmed against source before fixing. Wrong-but-confident skill text
  is worse than no text: it converts into debugging turns.
- **Port only what's cheap per line**: cost-asymmetry heuristic,
  reference-sharing canon, three gotcha rows, a GraphQL scope pointer —
  ~23 lines total.
- **Delegate instead of embed**: v2's 1,111-line generated API appendix
  answered a real need (no training-data presence → guessed signatures)
  with an always-loaded token bomb. The replacement is one rule: "never
  guess a signature — `deno doc jsr:@skmtc/core@<pin> <Symbol>`."
  On-demand, authoritative, never stale, zero cost until needed.
  Baselines proved agents excel at exactly this lookup.
- **Reject with a reason**: v2's essay-depth "why" prose — the EXP-2
  economics price always-loaded lines, and the evaluator's own
  observation ("both produce structurally similar generators") shows the
  doctrine transfers without the essay.

### F11. The verification-pipeline gap the review exposed

Our pipeline (source sweeps → grep-verify export names → compile-verify
the worked example) caught zero of the two API-shape bugs, because both
lived in PROSE claims about return types — grep confirms a name exists,
not what it returns; the engine test pins the example, not the
paragraphs. New hygiene rule: **any prose claim that names an API and
its return/argument shape needs a mechanical pin** — a quiz question
(cheapest), a typecheck snippet, or inclusion in the pinned example.
The external review's findings are the seed set for that quiz (C3):
"what does insertModel return?" catches bug #1 in minutes for pennies.
Corollary: compile-verification created justified confidence in the
example and UNjustified halo confidence in the surrounding prose.

### F12. Chain-stopping hygiene (runner infrastructure)

Stopping a sequential run chain safely requires three steps, in order:
TaskStop the chain, kill any orphaned per-run process, then VERIFY the
shared mutable state (the ~/.claude/skills symlink shuffle) restored —
the exit trap does not fire on a hard kill. Also remove partial results
dirs from the aborted run or they pollute later sweeps. All three were
needed when the Sonnet-skills chain was skipped mid-flight.

### F13. The trap confirmed: exemplar-poor baselines collapse to strings, 3/3

Task-2 (tag-grouped API client; no single cloneable exemplar) baselines:
every FUNCTIONAL gate passed on all three runs — accumulator shape,
dedup, engine-materialized zod schemas with stitched imports, lint
clean — while outsideShare hit 0.981 / 0.945 / 1.000 vs the 0.180
anchor (gen-eval "fail" ×3). Read together with task 1 (0.30–0.46 with
gen-zod visible), the conclusion is clean: **imitation of published
exemplars was doing nearly all of the disciplinary work; remove the
exemplar and composition reverts wholesale to string helpers, while the
engine's functional contract remains discoverable.** This is the
original "short-lived results" failure reproduced under instrumentation:
correct today, hostile to being built upon. The sharpest detail: the
fully-string run (oS 1.000) was also the fastest and cheapest of the
trio (28 turns, $4.62) — the string path is locally cheaper and pays
its cost downstream, which is precisely what makes it a trap and why
process metrics alone (speed, cost) must never be the ship gate.

### F14. The scaffolder result: under-a-minute, at-anchor discipline, 40× cheaper

Scaffolder v0 (template carries the coordination — entry, get-or-create,
container, anatomy; 4 slots carry the composition — naming + method
fields/data/render; slots filled by PARALLEL Haiku calls; targeted
Haiku-first slot repair): **3/3 final green on the exemplar-poor task,
2/3 first-pass, wall 26/30/181s, cost $0.118–0.247, outsideShare
0.157/0.180/0.200 — straddling the 0.180 reference anchor, gen-eval
clean.** The full same-task ladder:

| Approach | oS | Cost | Wall |
|---|---|---|---|
| Agentic baseline ×3 | 0.945–1.000 | $4.62–6.91 | 400–502s |
| Agentic + skills + inspector (n=1 so far) | 0.414 | $10.07 | 799s |
| One-shot Fable (pre-assembled context) | 0.196–0.338 | $0.45–1.72 | 291–429s |
| One-shot Haiku | 0.084 (functional FAIL) | $0.15 | 182s |
| **Scaffold + parallel Haiku slots ×3** | **0.157–0.200** | **$0.12–0.25** | **26–181s** |

Chain of findings that got here: baselines showed imitation carries
discipline (F2/F3); exemplar-poor showed discipline collapses without it
(F13); one-shot showed pre-assembled context beats the loop on cost AND
discipline; the Haiku split (aces style, fumbles coordination) mapped
the template/slot boundary; the scaffolder implements that boundary.
**Constraint beats instruction beats agency, in that order, for
authoring** — the less the model is asked to decide, the better AND
cheaper AND faster the outcome, provided the constraint encodes the
canon. Caveats: v0's template is task-shaped (hollowed from the
reference); the honest generalization is a template library per
generator SHAPE (model-projection, operation-projection, accumulator),
which is exactly what the stock generators already enumerate. Pilot-1's
skill-fix (toEnrichmentSchema function form) also demonstrated the
one-shot arm doubling as a cheap skill-regression probe: a wrong or
missing skill line surfaces as a deterministic failure signature within
one $0.50 run.

### F15. EXP-3c complete: the exemplar-poor hierarchy is monotone

Tools trio final: oS 0.414/0.437/0.514, all functional PASS, all
gen-eval "fail", $8.80–10.07, 60–81 turns, 531–799s — skills+inspector
halve the collapse but cannot restore idiom, at the highest cost of any
condition. The completed same-task ladder (updating F14's table with
full trio data):

| Condition | oS | Cost | Wall | Verdict |
|---|---|---|---|---|
| Agentic baseline ×3 | 0.945–1.000 | $4.62–6.91 | 400–502s | fail |
| Agentic + skills + inspector ×3 | 0.414–0.514 | $8.80–10.07 | 531–799s | fail |
| One-shot Fable ×2 | 0.196–0.338 | $0.45–1.72 | 291–429s | clean/warn |
| One-shot Haiku ×1 | 0.084 (functional FAIL) | $0.15 | 182s | — |
| **Scaffold + Haiku slots ×3** | **0.157–0.200** | **$0.12–0.25** | **26–181s** | **clean ×3** |
| Reference (hand-written) | 0.180 | — | — | clean |

The ordering — constraint > context > instruction > agency — is
monotone on ALL THREE axes simultaneously (discipline, cost, speed).
The day's single-sentence conclusion: for generator authoring, invest
in narrowing what the model must decide (templates, pre-assembled
context, slot contracts) before investing in teaching it (skills) or
supervising it (agentic loops with tools) — and keep the skills for
what only they do: making the narrow slots and the escalation path
correct. Skills' measured role shifts from "the agent's textbook" to
"the pipeline's canon": they define the templates' shapes, the slot
contracts' vocabulary, and the repair prompts' rules.
