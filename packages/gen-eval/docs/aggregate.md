# Aggregate verdict

**Not a check** — a derived summary over the check results, shown as
the `verdict` column. And deliberately **not a quality score**: it is a
defect aggregate. Zero defects = `clean`. There is no weighting — a
weighted 0–100 number would smuggle judgment back into a suite built on
facts ("why is an as-cast worth 3 points?").

## Definition

- **`FAIL(nF+mW)`** — `n` pass/fail checks failed, listed by id in
  `aggregate.failedChecks`. The failing checks are: structure,
  top-level-projection (when not accumulator-exempt), tostring-purity,
  adhoc-tostring, template-imports, runtime-discipline.
- **`warn(m)`** — no check failed; `m` counts warning **sites**:
  - flagged producer methods (check 3, after accumulator exemption)
  - as-casts (check 10)
  - raw definition registers (check 11)
  - TODO markers in emitted text (check 13)
  - `other` (non-producer) classes (check 2)
  - +1 if outside-toString string share ≥ 50% (check 4) — the one
    explicit threshold in the suite; the clean stock cohort sits at
    3–30%, the helper-module-style generators at 47–93%
- **`clean`** — neither.

## How to use it

Sort and compare: across harness runs (did the skill edit reduce the
count?), across models, across the stock fleet. Then read the
per-check columns and the markdown detail for *what* the defects are —
the aggregate is a pointer, never the conclusion. Two generators with
`warn(2)` can carry entirely different defects.

## Stock baseline reference points

`clean`: gen-typescript, gen-typescript-s, gen-zod-family tanstack
generators, gen-msw, the two single-projection reapit selects.
`FAIL`: the ad-hoc-toString offenders (arktype, reapit-form,
reapit-graphql-client), the structure-missing SDK/server generators,
and the two zero-Projection non-accumulator generators —
gen-kotlin-jackson-s at `FAIL(1F+10W)` is the reference sub-par
signature.
