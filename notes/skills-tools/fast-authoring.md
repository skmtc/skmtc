# Fast generator authoring — the under-a-minute strategy

Written 2026-07-31, from the day's 15 measured runs (see
`learnings/`, PLAN C-EXP/EXP-3). Goal: author a correct, idiomatic
generator in <60s wall, from today's best of ~270–500s at $4–7.

## 1. The arithmetic that forces the architecture

- Today's runs spend their time on **turns**: 28–91 agent turns. Even at
  2s/turn, a 40-turn loop cannot fit in 60s. → The agentic loop must be
  ELIMINATED from the happy path, not accelerated.
- A full package is 3–6k output tokens. At standard decode (~60–80
  tok/s) a single sequential generate-everything call is 40–75s BEFORE
  verification. → One big call is marginal. Under 60s requires one of:
  (a) generate fewer tokens (only decisions, not boilerplate);
  (b) generate in parallel (fan-out, wall = slowest slot);
  (c) faster decode (fast-mode / Haiku-class).
  These compound; (a) is the one that also solves quality.

## 2. Why the speed lever is also the quality lever

EXP-3b measured what happens without a cloneable exemplar: baselines
passed every functional gate while outsideShare collapsed to
0.945–1.000 (anchor 0.180) — composition reverted wholesale to string
helpers, and the fully-string run was the FASTEST AND CHEAPEST of its
trio. Speed pressure alone therefore pushes agents INTO the trap.
The slot-fill architecture resolves this: if the model only writes
inside pre-shaped `toString()` bodies — where strings are legal — the
0.981 failure mode becomes unrepresentable. Discipline by construction,
where instruction demonstrably fails.

## 3. The architecture

```
registry search ──hit──────────────────────────────→ ship        ~2s
  │ miss (or near-miss → one-slot patch ~10s)
context assemble (deterministic, prompt-cached) + scaffold        ~1s
parallel slot-fill (6–10 small calls, shared cached prefix)       5–10s
stream-assemble into WARM workspace (node_modules/deno pre-baked) ~1s
verify: engine (<1s) + deno check (2–5s) + lint + gen-eval        5–8s
  ├─ green → ship                                     P50 ≈ 15–25s
  └─ red → ONE repair call, error-fed, targeted slot  +10–15s
       └─ red again → escalate to the full agentic loop (>1min path)
```

Components:
- **Context assembler** (deterministic, <1s, cached): task spec +
  fixture digest + v3 skills + nearest exemplar source via the clone
  table + `deno doc` extracts for the APIs in play. Converts the $2–5
  discovery phase every baseline paid into a cached prefix.
- **Scaffolder**: the package anatomy is invariant (deno.json, mod.ts,
  src/{mod,base,enrichments}.ts, projection, router skeleton, snippet
  shells) — template-generated in milliseconds. Model fills only the
  decision slots: naming policy + per-schema-type toString bodies
  (600–1,200 tokens total, parallelizable).
- **Warm workspace pool**: kills the observed 30–60s cold-install.
- **Quality gates unchanged**: engine + typecheck + lint + gen-eval
  decide ship-vs-escalate at every tier. Speed NEVER trades against the
  standard — hard cases degrade to the slower path. (F13's corollary:
  process metrics must never be the ship gate.)
- **Recipe cache / registry compounding**: router mappings learned once
  per target library; second request for the same target ≈ lookup. The
  fastest authoring is no authoring.

Expected: P50 ~20s, P95 <60–90s, $0.20–0.60/request.
Model tier: slot-fill on Haiku/Sonnet-class (our data: discipline came
from structure+exemplars, not model size — Sonnet out-disciplined Fable
3/3); repair escalates a tier. Fine-tuning: NOT now (data-poor; slots
already small; the recipe cache is the cheaper distillation).

Rejected: faster agent loops (arithmetic); skipping verify/tsc (ships
the 0.981 problem at speed); hiding the registry (impossible + it's an
asset).

## 4. Build plan

1. **EXP-4 one-shot arm** (~half day; IN PROGRESS): pre-assembled
   context → ONE no-tools generate-everything call → programmatic
   verify → ≤1 repair. Won't hit 60s (token arithmetic) but measures
   the load-bearing unknown: FIRST-PASS GREEN RATE with full context,
   which prices the repair loop for every downstream architecture. Also
   measures whether embedded-context one-shots hold discipline on the
   exemplar-poor task.
2. **Scaffolder v0 + warm pool** (~2–3 days): template + slot spec +
   parallel structured-output fill + existing gates.
3. **Recipe cache + registry near-match patching** (compounding layer).

## 5. Relationship to the harness (PLAN workstream D)

This pipeline IS the authoring engine of the exemplar-anchored harness:
the harness's decompose phase produces the slot contents' spec; the
scaffolder is phase 4-5 made deterministic; escalation is the harness's
full agentic loop. Durable Flue sessions matter only for the >1min
escalation path.
