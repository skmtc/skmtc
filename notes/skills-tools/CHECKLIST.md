# Skills, tools, harness — execution checklist

Companion to `PLAN.md` (same directory — read it for rationale, decisions,
and gate definitions). Tick items here; update the plan's status markers
when a workstream milestone closes. Last sync: 2026-07-31.

## A — the v3 skills

- [x] A1 Source research: three sweeps (core / lang-typescript+TS gens /
      lang-kotlin+Kotlin gens), all claims file:line-cited
- [x] A2 Write `skmtc-generator-v3/SKILL.md` (engine, language-blind)
- [x] A3 Write `skmtc-lang-typescript-v3/SKILL.md` (template headings)
- [x] A4 Write `skmtc-lang-kotlin-v3/SKILL.md` (same headings + drift note)
- [x] A5a Export-name grep: every API name cited in the skills exists in
      lang-typescript / lang-kotlin / core source (passed 2026-07-31)
- [ ] A5b Load check: fresh Claude Code session lists all three v3 skills
      and loads each without frontmatter errors
- [x] A5c External review received 2026-07-31 (user-commissioned v2-vs-v3
      evaluation) → v0.2.1 (commit 4dcb9871): FIXED two verified
      accuracy bugs (insertModel returns Inserted — .toName()/.definition
      — not the definition; defineAndRegister is lang-package, not
      context). PORTED at low cost: cost-asymmetry heuristic,
      reference-sharing canon (assignment not getter — engine test
      realigned, still byte-for-byte), 3 instinct-catalog pitfalls,
      GraphQL scope pointer (→ skmtc-graphql). DELEGATED instead of
      ported: v2's 1111-line API appendix → "never guess a signature:
      deno doc jsr:@skmtc/core <Symbol>" (zero context cost, never
      stale). NOT ported (economics): v2's always-loaded essay depth —
      the EXP-2 data prices always-loaded lines; deep-why stays in v2/
      docs for on-demand reading
- [x] A6a Register v3 skills in docs/skills/README.md ecosystem table +
      `version: 0.1.0` frontmatter added (commit 8319c65b)
- [x] A6b Transition rule recorded in the v3 index row: runs ALONGSIDE
      v2 pending eval comparison (retirement criteria in PLAN §6)
- [x] Branch + commit: `docs/skills-v3-generator-authoring` @ b33ba826
- [ ] Push branch / open PR (on request)

## H — hardening (IMMEDIATE, ≤ half day, before C-EXP)

From the 2026-07-31 confidence review (PLAN §7):

- [x] H1 Compile-verify the Kotlin skill's worked example — PASSED
      first-run 2026-07-31: byte-for-byte match through the real engine,
      zero skill corrections needed. Kept as a permanent regression gate:
      `deno/lang-kotlin/src/skill-v3-example.test.ts`
- [x] H2 (= A5b) Fresh-session load check — PASSED 2026-07-31 via
      headless `claude -p`: all three v3 skills discovered, and
      skmtc-generator-v3 loaded without error (first heading confirmed:
      "# Authoring SKMTC generators"). NOTE the wiring found along the
      way: skill discovery runs through symlinks in `~/.claude/skills/` →
      repo dirs; the three v3 symlinks were created to match the existing
      convention. New-machine setup must recreate them (they live outside
      the repo)
- [x] H3 Ground-truth proto-B1 — DONE 2026-07-31 with
      `proto-inspect-subject.mjs` (this directory) against the animation
      capture. CAN show: per-subject definitions, value tree with class
      names, cross-generator provenance tags, file imports (incl.
      typeOnly), rendered text. CANNOT: per-lookup hit/miss (confirmed),
      event order. NEW finding: below the capture's depth bound leaves
      render as opaque strings ("[ZodString …]") — real B1 must raise the
      bound or reconstruct leaves (the animation demo reconstructed from
      generator sources)

## C-EXP — feedback-inversion experiment (PRIORITIZED — runs before B)

Tests the hypothesis the B tools rest on; outcome sets B's build order via
the decision table in PLAN §3. Harness carries forward as C0/T2/C2a.

- [x] EXP-0a DONE 2026-07-31 — fixture (`exp/fixture/openapi.json`: Order/
      OrderItem/OrderStatus/Address; enum, array-of-ref, shared ref ×2,
      optional, nullable) + task spec (`exp/template/TASK.md`); backup
      task (effect/Schema) + calibration criteria remain as stated
- [x] EXP-0b DONE — `exp/score.mjs`: verify exit, model presence, dup
      definitions, ref-import, skmtc lint firings, gen-eval summary
      (producerShare, strings.outsideShare, templateImports,
      adHocToString, aggregate). Validated on the smoke reference
      generator (`exp/smoke/gen-typebox`, written v3-style, ts-pattern
      router, JSR pins): all PASS, outsideShare 0.07 — the calibration
      anchor. Template resolves @skmtc/* from public jsr.io (user
      request: no absolute-path imports)
- [x] EXP-0c DONE (= H3) — proto-inspect-subject.mjs; wired into the
      tools arm as `inspect-subject.mjs` reading the harness's
      capture.json
- [x] EXP-0d DONE — `exp/run.sh`: per-run scratch workspace outside the
      repo; arm isolation by symlink shuffle in ~/.claude/skills (park
      all skmtc-*, restore-only-v3 for skills/tools arms, exit-trap
      restore; SEQUENTIAL runs only — the shuffle is global user state);
      near-identical working-method wording across arms; archives
      transcript + workspace + score to exp/results/<run-id>/
- [ ] EXP-1 Baseline arm, 3 runs (no skill, no tools) — kill criterion:
      does the trap fire at all? Watch one run for difficulty calibration
      - base-1 (2026-07-31): ALL METRICS PASS, gen-eval verdict "clean",
        producerShare 1.0, outsideShare 0.30 (vs reference 0.07), full
        package convention followed. Transcript: the agent FETCHED
        published @skmtc/gen-zod from JSR and imitated its architecture
        (its own words: "used the published @skmtc/gen-zod package as a
        structural reference"). Trap did NOT fire. CALIBRATION NOTE: the
        "too easy" criterion is arguably tripped — not by task
        triviality but by exemplar access; published stock generators
        are an uncontrolled teaching channel available to every arm.
        Design fork recorded in PLAN (exemplar-rich vs exemplar-poor
        condition). Runs 2-3 proceed unchanged for variance; capture
        upgraded to stream-json for process metrics (run.sh)
      - base-2 (2026-07-31): same verdict, 270s, 31 tool calls. Event
        stream shows the playbook explicitly: deno-cache hunt → `deno
        doc jsr:@skmtc/core` → curl'd lang-typescript + ModelDriver +
        ALL of gen-zod's source from jsr.io → wrote the package in one
        burst → verify PASS. outsideShare 0.46 (ref 0.07), verdict
        "clean", 13/13 producers clean. First code written was
        projection-shaped; no string-first draft at any point
- [ ] EXP-1b Sonnet baselines (user-approved 2026-07-31): 3 runs of the
      baseline arm with `--model sonnet` — tests whether the trap is
      absent in general or only at the frontier tier (base-1/2 ran on
      claude-fable-5 at ~$4/run; the tier real harness usage would pick
      is the tier where skills matter most). Model tier is now an
      explicit arm dimension; run.sh gains a MODEL argument after
      base-3 completes (not editable mid-run)
- [x] EXP-2 skills arm — Fable trio COMPLETE 2026-07-31; Sonnet trio
      SKIPPED by user (chain stopped after skills-3; partial
      sonnet-skills-1 removed; symlink state verified restored).
      Results (vs Fable baselines 0.30/0.46/0.46 oS, $4.05-4.94,
      32-46 turns): skills-1 oS 0.235 $4.59 46t; skills-2 oS 0.230
      $7.59 64t; skills-3 oS 0.266 $7.73 61t. All PASS/clean; 2 Skill
      invocations each; gen-zod refs collapsed 13→4→2 across runs.
      VERDICT: (1) discipline improvement real, consistent, modest —
      all three below all three baselines, variance collapsed, but
      still ~3× reference (0.07); (2) skills DID substitute for the
      exemplar safari behaviorally; (3) economics NEGATIVE — +60% cost,
      more turns: skill-following replaced the exploration tax with a
      bigger one. Exploration-tax hypothesis refuted at Fable tier in
      the exemplar-rich condition. Tools arm (skills+proto-B1) NOT run
      — deferred pending skill redesign
- [x] EXP-2 follow-on: skills redesigned as v0.2.0 (commit 7ae8f78d,
      2026-07-31) — 1116→499 lines (-55%); generator skill now leads
      with a clone-nearest-stock-generator table; litmus rule and
      engine-rules-imitation-can't-teach kept; TS worked example
      replaced by "the cloned exemplar IS the example"; Kotlin keeps
      its engine-pinned current-API example (regression test still
      passes byte-for-byte)
- [x] EXP-2c tools arm COMPLETE 2026-07-31 (3 Fable runs, v0.2.0
      skills + proto-inspect-subject) — THE BEST CONDITION ON EVERY
      AXIS: oS 0.130/0.077/0.120 (tools-2 statistically at the
      reference 0.07; ~3× better than baselines, ~2× better than
      v0.1.0 skills), cost $3.88/$3.83/$4.17 (cheapest Fable runs of
      the whole experiment), 40-41 turns and 268-310s (baseline pace,
      despite carrying skills + inspector). Agents loaded both skills
      (2 each), executed the inspector ONCE per run — at the END, as a
      final confirmation, not mid-loop (corrected 2026-07-31: earlier
      "4-6 calls" counted stream mentions, not executions) — and still
      consulted gen-zod (13-15 refs — clone-first channels imitation
      as designed). Two runs "warn" verdicts (minor gen-eval warnings,
      not discipline failures). Attribution between redesign and
      inspector remains confounded — separable later with a
      v0.2.0-skills-only trio if wanted — but the shipped package
      (v0.2.0 + inspector) dominates outright
- [x] EXP-1 COMPLETE (3 Fable runs) + EXP-1b COMPLETE (3 Sonnet runs),
      2026-07-31. 6/6: verify PASS, all models, zero dups, zero lint
      firings, gen-eval verdict "clean", producerShare 1.0. The trap
      NEVER fired at either tier. Every run's strategy: fetch published
      gen-zod (+ often core/lang-ts) source from jsr.io, imitate.
      outsideShare — Fable: 0.30/0.46/0.46; Sonnet: 0.185/0.080/0.192
      (Sonnet BETTER 3/3: heavier exemplar imitation inherits gen-zod's
      discipline; Fable improvises more). Cost: Fable $4.05-4.94,
      32-46 turns, 4.5-6 min; Sonnet $2.89-4.49, 60-91 turns, 11-12 min.
- [x] EXP-3 Verdict recorded (decision-table row "trap absent at
      baseline", qualified EXEMPLAR-RICH): the premise is re-examined —
      in exemplar-rich conditions correctness is saturated at both
      tiers and the trap is dead; skills/tools re-justify on (a) the
      exploration tax (30-91 turns re-deriving what skills carry as
      ~15k tokens — cost/latency), (b) discipline consistency (Fable's
      improvisation drift = exactly the litmus rule's target), (c) the
      EXEMPLAR-POOR condition (untested; where historical failures
      clustered and where the D-workstream use case lives). B build
      order: B1/B2 keep their slots but as reorientation/debugging
      value, not trap prevention. NEXT DECISION (user): EXP-2 with
      revised success metrics (cost/turns/outsideShare deltas) vs going
      straight to the exemplar-poor task design

## EXP-3 — exemplar-poor task (task2, user-directed 2026-07-31)

Task: `@exp/gen-api-client` — tag-grouped API client. Exemplar-poor by
COMBINATION: operation subjects + accumulator-per-tag + cross-generator
consumption of gen-zod — pieces exist separately on JSR (gen-tanstack,
gen-express), the combination does not. Trap pressure: shared Order
schema across 3 methods (cache dedup), cross-file zod imports that must
come from insert machinery, a container tempting string-append.

- [x] EXP-3a Rig built + smoke-validated (exp/task2/): fixture with 4
      ops/2 tags over the same 4 models; template (adds
      jsr:@skmtc/gen-zod@0.2.5 + zod); harness; TASK.md contract
      (per-tag class, method-per-op named from method+path, responses
      via engine-produced gen-zod schemas, no hand-written schema
      text/imports); score2.mjs (accumulator shape, dup defs,
      zod-via-engine, lint, gen-eval); run2.sh. Reference solution
      (smoke/gen-api-client, accumulator get-or-create +
      context.insertNormalizedModel(ZodProjection)) scores ALL PASS,
      verdict clean, **outsideShare 0.180 = the task-2 anchor** (client
      method bodies are legitimately string-heavier than task-1's 0.07
      — compare against 0.180)
- [x] EXP-3b Baseline trio COMPLETE 2026-07-31 — **THE TRAP FIRED 3/3**
      in its refined (discipline) form: every functional gate PASSED
      (accumulator shape, zero dups, zod-via-engine, lint clean — the
      machinery's contract was discoverable) but outsideShare
      0.981 / 0.945 / **1.000**, gen-eval verdict "fail" ×3, vs the
      task anchor 0.180. Without a cloneable exemplar, composition
      reverts wholesale to string helpers — functionally correct,
      idiomatically collapsed, the exact "short-lived results" failure.
      Note run 3: fully string-composed AND fastest/cheapest (28t,
      $4.62) — the string path is locally cheaper, which is precisely
      why it's a trap. Calibration: task NOT too hard (3/3 functional
      pass); the instrument works
- [x] EXP-3c Tools trio COMPLETE 2026-07-31: oS 0.414/0.437/0.514, all
      functional PASS, all gen-eval "fail", $8.80-10.07, 60-81 turns,
      531-799s. VERDICT: agentic + skills + inspector cuts the
      exemplar-poor discipline collapse roughly in half (~1.0 → ~0.45)
      at the HIGHEST cost of any condition — it resists the trap but
      cannot restore idiom. Combined with EXP-4/scaffold results the
      exemplar-poor hierarchy is total and monotone:
      **constraint (scaffold, 0.16-0.20, $0.12, 30s) > context
      (one-shot, 0.20-0.34, $0.45-1.72) > instruction (agentic+skills,
      0.41-0.51, $9-10) > agency (baseline, 0.95-1.0, $5-7)** — the
      less the model decides freely, the better, cheaper, AND faster
      the outcome

## EXP-4 — one-shot arm + scaffolder (user-directed)

- [x] EXP-4a One-shot rig (exp/task2/oneshot/): deterministic context
      assembly (skills + JSR partial exemplars + fixture) → ONE no-tools
      call → programmatic verify → ≤1 error-fed repair
- [x] EXP-4b Pilots: p1 Fable $0.45+repair FAIL (toEnrichmentSchema
      object-vs-function — a v0.2.0 compression casualty, skill fixed
      → 0.2.1 line) oS 0.196; p2 Fable first-pass GREEN $1.72 291s oS
      0.338; p3 Haiku FAIL functionally (accumulator coordination) but
      oS 0.084 — BEST discipline of all runs — $0.15 182s. Verdict:
      one-shot beats the agentic loop on cost AND discipline on the
      exemplar-poor task; wall bound by the single sequential call;
      Haiku = ideal slot-filler, wrong whole-package author
- [x] EXP-4c SCAFFOLDER v0 (exp/task2/scaffold/): template = the
      coordination Haiku fumbles (entry, get-or-create, container,
      package anatomy); 4 slots = the composition Haiku aces (naming,
      method fields/data/render), filled by PARALLEL Haiku calls;
      targeted slot repair (Haiku-first; escalation measured, not
      assumed — user challenge on Sonnet accepted). Pilots:
      **p1 GREEN 30s $0.119 oS 0.157 clean; p2 repair-round green 181s
      $0.247 oS 0.200 clean; p3 GREEN 26s $0.118 oS 0.180 clean.**
      **UNDER-A-MINUTE ACHIEVED: P50 ~30s, 2/3 first-pass green, 3/3
      final green, ~$0.12-0.25/run, discipline AT the reference anchor
      — on the exemplar-poor task.** Caveats: v0 template is
      task-shaped (hollowed from the reference — generalizing the
      template library is the real build); repair path refills 3 slots
      serially (optimizable); n=3
- [x] EXP-4d Sonnet-repair A/B (replay of scaffold-pilot-2's exact
      failure, same serial procedure): Sonnet's FIRST call alone 485s /
      $1.68 (run timed out at 10min before call 2) vs Haiku's complete
      3-call repair 147s / $0.12 (which succeeded). ~10× slower, ~14×
      costlier per call. Haiku-first repair is MEASURED policy; Sonnet
      escalation reserved for Haiku-fails-twice (not yet observed)

## A+ — shape skills (skmtc-model-v3, user-directed 2026-08-03)

Decision: encode the SHAPE axis (model vs operation vs accumulator) as
skills that ship a fill-in skeleton — "constraint beats instruction"
(the EXP-3/4 hierarchy) applied to skill design. Model shape first.

- [x] skmtc-model-v3 authored 2026-08-03 (worktree skmtc-skills-v3,
      branch docs/skills-v3-generator-authoring): SKILL.md (~150 lines,
      copy-rename-fill method, 12-slot table, edge-case canon, model
      pitfalls) + `skeleton/` — a complete engine-tested TS model
      generator (per-type snippet classes, gen-zod's modelDepth
      recursion protocol, additionalProperties/record, visibility
      capture, handleKey, ts-pattern exhaustive router typed as
      SchemaToValueFn, placeholder lib in src/lib.ts). Verified:
      deno check clean, skmtc lint clean (no-slow-types excluded like
      stock gens), 6/6 engine-pinned tests via real toArtifacts
      (fixture: enum, array-of-ref, shared ref ×2 → ONE definition,
      optional+nullable, record, self-recursion → lazy + typeName).
      Test doubles as the copied package's regression gate.
- [x] Dedup/pointers: generator-v3 §2 model row + §7 now point to
      skmtc-model-v3 (0.2.1 → 0.2.2); lang-typescript-v3 intro likewise
      (→ 0.2.2); README ecosystem row added; ~/.claude/skills symlink
      created. No content cuts needed — v0.2.0 had already removed the
      model worked-example, so the shape skill fills a hole.
- [ ] EXP-5 — model-shape skill test in the harness (design below)
- [ ] Kotlin model skeleton (later; skill §6 marks the gap)
- [ ] Operation/accumulator shape skill (the EXP-3b collapse zone —
      the sequel once EXP-5 reads out)

## EXP-5 — model-shape skill vs baseline, OPUS tier (user-directed 2026-08-03)

Tests skmtc-model-v3's claim: the skeleton substitutes for the missing
exemplar in the exemplar-poor MODEL condition. Task1 (TypeBox) is
exemplar-rich (everyone imitates jsr gen-zod); task2 is exemplar-poor
but accumulator-shaped — wrong shape for this skill. So: new task1b.

- Model tier: **claude-opus-5 for ALL EXP-5 runs** (user decision
  2026-08-03 — not Fable, not Sonnet). run.sh already takes MODEL.
  Prior anchors (Fable/Sonnet/Haiku) are cross-tier — directional
  comparisons only; EXP-5's baseline arm re-anchors at Opus.
- [x] EXP-5a Rig DONE 2026-08-03 (exp/task1b/): fixture = task-1's
      four models + self-recursive Category; template (effect@^3.10
      dep, harness, check config, TASK.md with PascalCase contract +
      suspend hint at task-1's hint parity); score1b.mjs = score.mjs +
      Category expected + recursion-lazy check + skeleton-adoption
      process metric (SLOT-marker count + lib.ts fingerprint, reported
      never gated); run1b.sh (arms baseline|skills, model DEFAULTS to
      opus, SKILL_SRC points at the skmtc-skills-v3 WORKTREE, restore
      set includes skmtc-model-v3). Smoke reference
      (smoke/gen-effect-schema) built FROM the skeleton via
      copy-rename-fill — the method dogfooded: mechanical rename +
      11 slot edits, zero machinery changes, 6/6 re-pinned tests,
      verify PASS incl. emitted-code typecheck against real effect
      (Schema.suspend annotation idiom works), all score gates PASS.
      **task1b anchor: outsideShare 0.177** (verdict clean,
      producerShare 1.0; residual = applyModifiers-style leaf helpers,
      same profile as gen-zod). Effect syntax notes: optional/nullable
      are WRAPPERS (Schema.optional/NullOr) not postfix methods;
      Literal variadic; recursion annotation lives on the suspend
      closure, so SLOT(recursion-annotation) is a no-op for this
      target.
- [x] EXP-5b Baseline trio COMPLETE 2026-08-03 (Opus): oS
      1.000 / 0.499 / 1.000, verdicts fail/clean/fail, ALL functional
      gates pass ×3 (incl. Category recursion — every baseline landed
      Schema.suspend correctly), $4.61-5.86, 106-116 turns, 468-495s.
      Calibration confirmed: trap fires at full strength (2/3 total
      collapse, 1/3 half), task not too hard. NOTE: unlike every
      task-1 run, Opus never fetched gen-zod (0 refs in all 3
      transcripts) — went straight to improvised string builders
      (toEffectValue/indent helper stacks, 3-file packages).
- [x] EXP-5c Skills trio COMPLETE 2026-08-03 (Opus,
      generator-v3+lang-ts-v3+model-v3): oS 0.223 / 0.189 / 0.241
      (anchor 0.177; skills-2 statistically AT it), verdict clean ×3,
      all gates pass ×3, skeleton ADOPTED 3/3 (25-27 SLOT markers +
      lib.ts in every package), $2.74-3.80, 77-100 turns, 327-446s.
      **VERDICT — decision-table row "at/near anchor at baseline-ish
      cost", exceeded: the shape-skill approach is CONFIRMED, and for
      the first time in the workstream a skill arm beat baseline on
      EVERY axis simultaneously — discipline 4× (mean 0.83 → 0.22),
      variance ±0.25 → ±0.03, cost -35% (mean $5.21 → $3.27), time
      -20% (478s → 389s mean; skills-3 fastest+cheapest agentic run
      of the whole program at $2.74/327s). The July "skill-following
      tax" is GONE: copying a skeleton is cheaper than improvising,
      where following prose instructions was dearer. Constraint >
      instruction, now demonstrated WITHIN the skill medium.**
      Consequences: (a) build the operation/accumulator shape skill
      next (EXP-3b's collapse zone); (b) skeleton-per-shape becomes
      the v3 design doctrine — prose carries only what the skeleton
      cannot (edge-case canon, boundaries); (c) EXP-5d one-shot arm
      remains open to test skeleton-as-scaffolder-template.
- [ ] EXP-5d (optional, after 5c) one-shot arm with skeleton in
      context — checks whether the scaffolder pipeline should just
      ship the skeleton as its template for model targets.

## task1k — Kotlin+Jackson model generator (user-directed 2026-08-03)

Deliverable run, not an experiment: author gen-kotlin-jackson through
the harness (skills arm: model-v3 + generator-v3 + lang-kotlin-v3,
Opus), then validate on a large real schema. Hardest condition to
date: NO Kotlin skeleton exists — model-v3 contributed shape rules
only; call shapes came from lang-kotlin-v3's engine-pinned example.

- [x] Rig (exp/task1k/): fixture = task1b's 5 models with snake_case
      wire keys + hard-keyword `object` property + recursive Category;
      kotlin-checks.mjs replaces deno-check (no kotlinc): package
      directive, @JsonProperty placement/composition, single-?, enum
      shape, same-package import suppression. RIG BUG found post-run:
      `List<OrderItem>\b` word-boundary regex can never match before
      `,` — fixed in template + archive; the generator had been green.
- [x] kotlin-jackson-1 (Opus): $9.05, 136 turns, 1292s (tail inflated
      by the rig bug — agent looped on an unsatisfiable check it was
      forbidden to edit). oS 0.194, verdict clean, producerShare 1.0,
      lint clean, model-v3 patterns adopted WITHOUT a skeleton
      (lib.ts + 25 SLOT markers + shape.ts dispatch per lang skill
      §1). Output quality: backticked `object` with NO @JsonProperty
      (composition rule applied), UPPER_CASE enum entries with
      per-entry @JsonProperty, single-? + `= null` throughout.
- [x] Large-schema validation: reapit.json (Swagger 2.0, 491 schemas)
      → converted via workspace swagger2openapi → **491/491 files,
      0 errors, 164ms**, 4 parseIssues (input quirks). Sweeps: zero
      `??`, zero duplicate declarations, zero same-package imports;
      134 files carry @JsonProperty (HAL `_embedded`/`_links` renamed
      correctly); required-vs-optional split correct (CreateX models);
      integer enums → `typealias X = Int`. LIMITATION found: inline
      (anonymous) nested objects render `Map<String, Any?>` — the
      converted Reapit spec is fully inlined (0 schema-to-schema
      refs), so this fallback carries much of the spec; typed-ref
      machinery is fixture-proven but unused here. Enhancement
      candidate: synthesize named classes for inline objects via
      insertNormalizedModel + fallbackName (needs a task1k follow-on).
      Kotlin-skeleton authoring for skmtc-model-v3 would also close
      the no-skeleton gap this run exposed ($9.05/21min vs task1b's
      $3.27/6.5min WITH skeleton).
- [x] Second large schema: OpenAI spec (3.1.0 YAML, no down-convert —
      core parses 3.1 natively per @skmtc/convert docs; only YAML
      parse needed). **1016 files in 124ms, 2 errors** — both from a
      DANGLING REF in the spec itself (ImageRefParam missing from
      components; engine isolated the one subject). 868 data classes,
      61 enum classes (ref + enum paths fire: `val role: MessageRole`),
      87 typealiases, zero ??/dups. 485 parseIssues all input-quality
      (description-on-ref, `unixtime` format, min_items-on-number spec
      typos). Union finding: oneOf renders `Any` / `typealias X = Any`
      — agent DOCUMENTED the decision in SLOT(union) (anonymous unions
      don't exist in Kotlin; proper modeling = sealed interface +
      @JsonTypeInfo/@JsonSubTypes, a top-level declaration). Sealed-
      interface union support is the #2 enhancement after inline-object
      synthesis.

## B — reorientation tools

*Build order below is provisional until EXP-3; B1/B2 are confirmed first
only if the feedback-inversion claim holds.*

- [ ] B1a `inspect-subject` CLI: given (generator, subject) print value
      tree, rendered text, imports declared, definitions registered —
      built on the `--debug` capture (per-lookup cache hit/miss is NOT in
      the capture; that reporting belongs to B3's trace)
- [ ] B1b Gate: one command answers "what did my generator just do for
      subject X?" on the demo project
- [ ] B2a Extend lint: template literals with target-language punctuation
      stored on fields
- [ ] B2b Extend lint: inline string names shadowing cache identifiers
- [ ] B2c Wire extended lint into the stock-generator `deno.json`s and the
      skills' §10/§11 references
- [ ] B3a0 Feasibility spike: minimal custom `toArtifacts` runner
      assembling its own `toGeneratorConfigMap` with wrapped transforms —
      prove the seam before building the event vocabulary
- [ ] B3a Trace wrap-harness: instrument transforms + projection classes
      from outside core; record the event stream
- [ ] B3b Gate: machine trace reproduces the animation demo's hand-authored
      ordering for the covered slice (closes the animation Tier-1 too)
- [ ] B3c Revisit un-parking core M5 trace sink when engine work opens
      (instrumentation points in generator-animation-demo/PLAN.md M5)
- [ ] B4 Golden diff: manifest-level before/after diff (files, definitions,
      identifiers, imports, cache stats)
- [ ] B5 `explain-ref`: identifier → claiming projection, exportPath,
      hit-or-miss from a given consumer, what a miss constructs
- [ ] B6 (deferred) MCP wrapper — only when a hosted context needs it

## C — evaluation

- [ ] C0 Benchmark harness plumbing: fresh-session runner, skill loading
      matrix (v3 / v2 / none), result capture — extend the EXP-0d runner
- [ ] C1 Author the six benchmark tasks with machine-checkable success
      criteria (T1 clone+field-type, T2 TS model gen — promote the EXP-0a
      fixture, T3 Kotlin model gen, T4 cross-generator consumer, T5
      enrichment seam, T6 export-path policy change)
- [ ] C2a Outcome metrics wired: compile, identifiers@paths, unresolved
      imports = 0, cross-gen refs are cache hits, lint firings = 0,
      gen-eval checks green
- [ ] C2b Process metrics wired: tool usage, edit-revert cycles,
      time-to-first-correct-render, first-code-shape (projection vs string)
- [ ] C3 Write the ~15-question concept quiz + engine-truth answer key
- [ ] C4a First baseline run: v3 vs v2 vs no-skill; record scorecard
      (skill version × engine version × task)
- [ ] C4b Feed failures/quiz misses into the retro pipeline as friction
      entries; schedule skill edits; re-run after each edit
- [ ] C4c Decide v2 retirement per criteria (PLAN §6)

## D — authoring harness

- [ ] D0 Confirm Flue `useTool` / sandbox API against current docs (deep
      links 404'd on 2026-07-31 review)
- [ ] D1a Manual end-to-end in Claude Code: Spring Boot + chosen
      serialization lib scenario, gen-kotlin-spring as clone base, v3
      skills + B1/B2 as the loop
- [ ] D1b Capture every friction point from D1a into PLAN/skill edits
- [ ] D2 Flue agent: phases in durable state, B-tools as useTool, sandboxed
      compiles, CF Workers deploy alongside skmtc-platform
- [ ] D3 Exemplar sourcing pipeline: search → rank → adapt → user sign-off
      → commit exemplar as golden-subject fixture in the produced generator

## Housekeeping

- [ ] File issue: migrate `skmtc-generators/gen-kotlin-*` to lang-kotlin
      HEAD API (KtAnnotation object-args etc.) so the v3 Kotlin skill's
      examples match shipped code
- [ ] v2 lesson harvest — DEFERRED by user 2026-07-31 ("later; keen to
      see what v3 can do first"). Revisit after the C-battery baseline;
      still requires explicit approval before reading v2 (PLAN §6)
- [ ] Decide skill distribution beyond this repo (CLI `agent-context`?
      hub?) and any format constraints that follow
- [ ] Periodic: re-run A5a export-name grep + C3 quiz after engine/lang
      package changes (the skills' regression gate)
