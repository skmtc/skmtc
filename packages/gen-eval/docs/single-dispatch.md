# Check 16 — `schema.type` dispatch lives only in the `SchemaToValueFn` router

**Verdict:** pass/fail (a failure sets the aggregate to `FAIL`).

## What it asserts

The generator has exactly one schema-dispatch site. Every place the
source inspects a schema's `.type` to make a decision — a
`switch (schema.type)`, a `schema.type === 'object'` comparison in a
ternary or if-chain — is classified by where it sits:

- **router** — inside a function named `to<X>Value` /
  `schemaToValueFn`, or one annotated with `SchemaToValueFn`. The
  sanctioned site: the generator's single schema→value mapping.
- **metadata** — inside `toIdentifierType` or `isSupported`. These
  are the mapping's metadata policies: they decide what a node is
  *called* (declaration kind) or whether it is handled at all, never
  what renders it.
- **outside** — anywhere else. One or more outside sites fail the
  check.

## Why

The generator skill's axiom 1: a generator is a total mapping from IR
nodes to producers, and a schema node becomes output through exactly
two doors — `insertModel` / `insertNormalizedModel` for named
schemas, the generator's `SchemaToValueFn` router for everything
else. Composites route their children back through the same function.

A `schema.type` conditional outside the router is a third door: a
projection reserving a type for itself, a value class switching on
schema type while rendering, a helper doing its own dispatch. Each
special case forks the mapping — the same node can now take different
paths depending on who touches it — and that is the road to broken.
If a type needs different handling, that is a new router case
returning a new snippet.

## Calibration

- `@skmtc/gen-zod` — pass (1 router site: `toZodValue`'s switch).
- `@skmtc/gen-typescript` — pass (0 counted sites: it dispatches via
  ts-pattern `match`, which this check does not flag — no false
  positive, though its router sites are invisible to the counter).
- The pre-skeleton `--lang kotlin` scaffold (run
  `20260718-181358` workspace) — FAIL with 6 outside sites: the
  `KtType` monolith's constructor + `toString` switches, a projection
  constructor switch, and two dispatching helpers. This is the shape
  the check exists to catch.
- The current `create --lang kotlin` skeleton — pass (1 router site,
  1 metadata site).

## Limits

Detection is name- and annotation-based: a router must be named
`to<X>Value` / `schemaToValueFn` or carry the `SchemaToValueFn` type
annotation to be recognized. Dispatch via ts-pattern `match()` is not
counted at all. Comparisons only count when the literal is one of the
schema `type` values (`string`, `integer`, `number`, `boolean`,
`array`, `object`, `union`, `unknown`, `ref`, `custom`, `void`,
`null`), so `KtEntityType` comparisons (`'data-class'`,
`'typealias'`, …) and manifest/JSON `.type` checks do not false-positive.
