# Check 7 — Producer size buckets

**Verdict:** informational (`max-size` column; distribution + named
large producers in the markdown report).

## What it asserts

Nothing pass/fail — it tracks how large producer classes are, as a
proxy for decomposition health.

## Why

Producers compose: a Projection that grows past a couple hundred lines
is usually absorbing branches that should be delegate Snippets (the
orchestrator–delegate pattern). Size drift across harness re-runs is
also a cheap regression signal — a skill edit that halves the largest
producer is visible here without reading the diff.

## How it is measured

Each producer class's line span (declaration start to end), bucketed to
the nearest 50 with a minimum bucket of 50 (`≤50`, `≤100`, …). The
table shows the largest bucket; the markdown report shows the full
distribution and names every producer at or above 150 lines with its
exact line count.

## Reading the result

The clean stock cohort tops out at ≤50–100. `gen-typescript-sdk`
(≤250) and the SDK family (≤150–200) are the sprawl end. Compare
distributions, not single maxima, when judging a re-run.
