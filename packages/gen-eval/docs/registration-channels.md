# Check 11 — Registration channels

**Verdict:** informational (`raw-reg` column; call counts + sites in
JSON/markdown).

## What it asserts

Nothing pass/fail yet — it counts how output reaches Files:

- Driver-path composition: `insertOperation`, `insertModel`,
  `insertNormalizedModel`
- the sibling/aggregate primitive: `defineAndRegister`
- **raw definition registration**: `register(...)` / `registerInto(...)`
  calls whose arguments include a `definitions:` property — hand-built
  Definitions pushed past the Driver machinery

## Why

The Driver path provides cache identity, `ContentSettings`, peer
support enforcement, and import wiring; `insertNormalizedModel` handles
the inline-schema case that tempts authors into hand-building
Definitions. Raw registration forfeits all of that. It is held
informational (not FAIL) pending a decision on whether legitimate uses
survive — the baseline exists to collect the evidence.

## How it is measured

Call-expression counting in the shared AST pass. The raw-register
detection requires a literal `definitions:` property among the call's
object-literal arguments, so a pre-built args object passed by variable
is not caught (known gap, acceptable for now).

## Baseline evidence so far

- `gen-kotlin-jackson-s` — 1 raw site, and it is the generator's entire
  output path (`register(context, { definitions: [new KtDefinition(…)] })`
  in `transform`). The pathological case.
- `gen-shadcn-table` — 1 raw site: a private `noExport: true`
  `columnHelper` sibling in the projection's own file. The
  candidate-legitimate case (arguably should be `defineAndRegister`).
- `gen-kotlin-sdk` — 2 sites (`emitStaticFiles`, `ensureModelDefinition`),
  static-file emission worth individual review.

## Reading the result

Read `raw-reg > 0` together with check 5: raw registers + no Projection
= the Driver-bypass pattern; raw registers + a healthy Projection =
probably a sibling that predates `defineAndRegister`.
