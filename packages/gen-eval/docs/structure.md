# Check 1 — Expected file and folder structure

**Verdict:** pass/fail.

## What it asserts

The generator package has the canonical shape:

- `deno.json` — parseable, with a `name` matching `@scope/gen-*` (the
  `gen-` prefix is the CLI's discovery filter)
- `mod.ts` — the package root entry (default-exports the entry object)
- `src/mod.ts` — the entry factory config (`toOasOperationEntry` /
  `toModelEntry` / `toGqlOperationEntry`)
- `src/base.ts` — the projection-base factory call (declares the target
  language via its lang-package import)
- `src/enrichments.ts` — the Valibot enrichment umbrella

## Why

The three-file `src/{mod,base,enrichments}.ts` split is the shape every
scaffold, skill card, and stock generator uses; a generator missing one
of them either merged concerns into one file or is missing the concern
entirely (e.g. no `base.ts` in a generator with no Projection — see
check 5).

## How it is measured

File existence on disk plus a JSON parse of `deno.json` and a regex on
its `name`. No AST involvement.

## Reading the result

`missing` lists what's absent. A missing `src/base.ts` alongside a
check-5 FAIL usually means the generator never created a projection
base at all (the gen-kotlin-jackson-s signature includes a base.ts that
exists but contains no factory call — structure alone cannot catch
that; check 5 does).

## Known exceptions

Accumulator-only generators sometimes omit `src/base.ts` legitimately
(no Projection to base). Judge together with checks 5 and 6.
