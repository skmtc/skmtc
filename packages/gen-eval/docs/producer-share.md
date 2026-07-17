# Check 2 — Generator consists primarily of producers

**Verdict:** informational (`producer%` column, class lists in the
markdown report).

## What it asserts

Classes in a generator should overwhelmingly be **producers** —
Projections or Snippets. Plain classes (`other`) and large fleets of
top-level helper functions indicate composition logic living outside
the producer model.

## Why

In the generation model, a generator converts each IR object into a
producer, and producers compose via `${...}` interpolation and
`insert*`. A class that is neither a Projection nor a Snippet cannot
register imports, has no attribution, and is invisible to the
coordination machinery.

## How it is measured

Classification is a package-local fixpoint over extends-chains:

- seeds: consts assigned from a `to*ProjectionBase(...)` factory call →
  projection; imported names matching `*Snippet`/`SnippetBase` →
  snippet; imported `*Projection` peers → projection
- iterate: a class extending a known projection/snippet name inherits
  that kind, until stable
- everything else → `other`

`producer% = (projections + snippets) / all classes`. Top-level
functions (declarations and const arrows) are listed as
`helperFunctions` — they are not counted in the share but are the place
to look when check 4's outside-string share is high.

## Reading the result

The stock baseline is 100% for nearly every generator; `other` classes
deserve individual inspection (they may be genuinely fine — e.g. a
hand-rolled client class — or a Snippet that failed to extend the lang
base). A class in `other` that the author *intended* as a producer is
usually an unwired base import.

## Known exceptions

Classes extending unrecognized third-party bases land in `other` by
construction — verify before concluding.
