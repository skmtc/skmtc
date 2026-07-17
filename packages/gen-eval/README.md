# @skmtc/gen-eval

Structural eval for SKMTC generators. Mechanical, syntactic-AST checks —
no LLM judging, no type resolution — derived from the generation model in
the `skmtc-generator` skill. Built to (a) baseline the stock generators
and (b) grade generators authored by models in skill-eval harness runs.

## The five checks

1. **Structure** — the expected package shape exists: `deno.json` (named
   `@scope/gen-*`), root `mod.ts`, `src/mod.ts`, `src/base.ts`,
   `src/enrichments.ts`. Reported as the list of missing files.
2. **Producer share** — classes are classified as **projection**
   (extends a const built by a `to*ProjectionBase` factory, transitively),
   **snippet** (extends a `*Snippet`/`SnippetBase` base, transitively), or
   **other**. A generator should consist primarily of producers;
   `producer% = producers / all classes`.
3. **Method discipline** — producers should have no methods beyond
   `constructor` and `toString()`. Extra methods (including accessors) are
   listed per class. Known legitimate exception: accumulator values like
   `gen-msw`'s `MockRoutesList.add`.
4. **String composition inside `toString()`** — template expressions,
   string concatenation, and `.join()` calls are attributed to the
   lexically enclosing function and bucketed: inside a `toString` body,
   inside a naming static (`toIdentifierName` / `toExportPath` /
   `toPackageName` — expected and excluded from the ratio), or **outside**.
   High outside share means composition logic lives in helper functions
   instead of producers rendering themselves. Top offending sites are
   listed per file+function.
5. **Top-level Projection** — at least one Projection class exists.
   Generators using the accumulator pattern (`defineAndRegister` present)
   are exempt when they have none.

Checks 1 and 5 are pass/fail facts. Checks 2–4 are reported as numbers
and per-site listings for human interpretation — there is deliberately no
composite score.

## Usage

```bash
# one generator
node src/cli.ts ../../../skmtc-generators/gen-zod

# scan a directory of gen-* packages, write reports
node src/cli.ts --scan ../../../skmtc-generators \
  --json baselines/<date>-stock.json --md baselines/<date>-stock.md
```

Runs directly on Node ≥ 23 (native type stripping); no build step.

## Baseline

`baselines/2026-07-17-stock.md` holds the first sweep across
`skmtc-generators/`. Highlights that validated the analyzer against known
ground truth:

- `gen-typescript`, `gen-zod`, `gen-shadcn-form` (the canonical clean
  generators): 1 projection + snippet fleet, all producers
  constructor+toString only, low outside-string share.
- `gen-kotlin-jackson-s` (known sub-par): **zero Projections** — every
  class extends `KtSnippet` and `transform` hand-builds a `KtDefinition`
  via raw `register`, bypassing the Driver path. Caught as `top-proj: FAIL`.
- `gen-msw`: flagged exactly its known accumulator exception
  (`MockRoutesList.add`).
- `gen-csharp-aspnet`, `gen-kotlin-spring`: no projection but
  `defineAndRegister` present → correctly `exempt(acc)`.

## Caveats

- Classification is syntactic and package-local. A class extending an
  unrecognized peer base lands in `other` — inspect before concluding.
- The string metric counts template *expressions* (with `${}`),
  string `+`/`+=`, and `.join()` calls; plain string literals are not
  counted. `join('@', …)` from `@std/path` is a bare call, not a property
  access, so it is not counted.
- "Outside share" is `outsideChars / (insideToStringChars + outsideChars)`.
  Naming statics are excluded from both sides.
