# Check 5 — A top-level Projection exists

**Verdict:** pass/fail; exempt only under check 6's accumulator verdict.

## What it asserts

At least one class in the generator is a Projection — a producer with
file-scope identity, built on a `to*ProjectionBase` factory, wrapped in
a Definition by a Driver.

## Why

The Projection is how output enters the Driver path: cache identity at
`(identifier.name, exportPath)`, `ContentSettings`, per-item
enrichment resolution, and reachability by peer generators via
`insert*`. A generator with no Projection is producing output some
other way — usually hand-registering Definitions — which forfeits all
of that. This is the exact failure signature of the sub-par
`gen-kotlin-jackson-s`: 23 snippets, zero Projections, output pushed
through raw `register(context, { definitions: [new KtDefinition(…)] })`.

## How it is measured

Check 2's classification: any class whose extends-chain reaches a
`to*ProjectionBase` const (or a peer Projection import).

## The accumulator exemption

Accumulator generators may legitimately have no Projection — their
artifact is a shared aggregate built with `findDefinition` +
`defineAndRegister`. The exemption applies **only** when check 6's
evidence-based verdict holds; a bare `defineAndRegister` mention is not
enough.

## Reading the result

`FAIL` + `acc: no` → the generator bypasses the Driver path without the
accumulator justification. Expect check 11 to show raw definition
registers, and expect the fix to be introducing a projection base.
