# Check 6 — Evidence-based accumulator detection

**Verdict:** a fact (`acc` column) that switches the grading rules of
checks 3 and 5.

## What it asserts

Whether the generator is **accumulator-style**: it emits a top-level
container value (an object, array, or map) that many producer
invocations write into, instead of each item writing its own file-level
Definition. Canonical example: `gen-msw`'s `toRoutesList`.

## Why it must be evidence-based

`defineAndRegister` alone is NOT proof — it is also the legitimate
primitive for private sibling Definitions in a file the generator owns.
Treating any mention as "accumulator" would hand out check-3/check-5
exemptions to generators that simply bypass the Driver path.

## How it is measured

The verdict requires a `defineAndRegister` call AND at least one of:

- a `findDefinition` call (the look-up-then-create-or-mutate shape), or
- a **container producer**: a producer class with a method that mutates
  a `this.<prop>` path via `push`/`add`/`set`/`unshift`/`splice`/
  `delete`. The mutation itself marks `<prop>` as the container, so
  initialization style doesn't matter (literal, `new Map()`, or a
  builder like `List.toArray([])`).

All signals are reported verbatim so the verdict is auditable.

## What the verdict switches

- **Check 3**: mutator methods on the detected container producers are
  bucketed `accumulatorExempt` and count as clean.
- **Check 5**: a generator with no Projection is exempt.

## Reading the result

`acc: yes` with a Projection present (e.g. `gen-msw`, `gen-kotlin-sdk`)
is the normal hybrid — per-item artifacts plus a shared aggregate.
`acc: no` + check-5 FAIL is the bypass smell, not an accumulator
design.
