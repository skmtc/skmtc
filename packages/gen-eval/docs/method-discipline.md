# Check 3 — Producers are constructor + toString only

**Verdict:** graded (`clean/producers` column), accumulator-aware.

## What it asserts

A producer class should have **no methods beyond `constructor` and
`toString()`**. State is set in the constructor; `toString()` renders
it. Extra methods (including get/set accessors) are listed per class.

## Why

The constructor/toString contract is the producer lifecycle: the
constructor runs at most once per cache key and does the side effects;
toString renders pure. Extra methods usually mean the class is being
used as a service object or a string-builder — logic that belongs in
Snippets composed via interpolation.

## How it is measured

Method declarations and accessors on classes classified as producers
(check 2), minus `constructor` and `toString`.

## The accumulator exemption

When check 6's verdict holds, mutator methods on the detected container
producers are bucketed as `accumulatorExempt` and count as clean — an
accumulator value grows by design (`gen-msw`'s `MockRoutesList.add` is
the canonical case). Without the verdict, the same methods are flagged.

## Reading the result

`flagged` entries name the class and its extra methods. A producer
with several methods is usually doing composition that should be
delegated to child Snippets (see the orchestrator–delegate card in
the skmtc-generator skill). **JS getters are an anti-pattern, not a
harmless helper** — the canonical offender is the protocol mirror
(`get annotations() { return this.value.annotations }`). The fix is
not a copied field (`this.annotations = this.value.annotations` —
the same fact in two places, which the check cannot see): a field
other code reads off a producer belongs directly on that producer,
not one level deeper and mirrored out.
