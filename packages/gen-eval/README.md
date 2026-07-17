# @skmtc/gen-eval

Structural eval for SKMTC generators. Mechanical, syntactic-AST checks —
no LLM judging, no type resolution — derived from the generation model in
the `skmtc-generator` skill. Built to (a) baseline the stock generators
and (b) grade generators authored by models in skill-eval harness runs.

**Each check is a separate module** under `src/checks/`, running as a
pure function over the facts produced by a single shared AST pass
(`src/parse.ts`) — adding a check never adds a parse. **Each check is
documented** in [`docs/`](docs/README.md), one page per check: what it
asserts, why, how it is measured, and the known legitimate exceptions.

## The checks

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
   listed per class. In generators with a confirmed accumulator verdict
   (check 6), mutator methods on the container producer are bucketed as
   `accumulatorExempt` and count as clean — `gen-msw`'s
   `MockRoutesList.add` is the canonical case.
4. **String composition inside `toString()`** — template expressions,
   string concatenation, and `.join()` calls are attributed to the
   lexically enclosing function and bucketed: inside a `toString` body,
   inside a naming static (`toIdentifierName` / `toExportPath` /
   `toPackageName` — expected and excluded from the ratio), or **outside**.
   High outside share means composition logic lives in helper functions
   instead of producers rendering themselves. Top offending sites are
   listed per file+function.
5. **Top-level Projection** — at least one Projection class exists.
   Generators with a confirmed accumulator verdict are exempt when they
   have none.
6. **Accumulator detection** — a generator counts as accumulator-style
   only on evidence, not on a bare `defineAndRegister` mention (that is
   also the legitimate private-sibling primitive): it must call
   `defineAndRegister` AND either call `findDefinition` or contain a
   **container producer** — a producer class with a method that mutates a
   `this.<prop>` path (`push`/`add`/`set`/`unshift`/`splice`/`delete`),
   which also marks `<prop>` as the container regardless of how it was
   initialized (literal, `new Map()`, or a builder like
   `List.toArray([])`). The verdict switches the exemptions in checks 3
   and 5, so acc and non-acc generators are graded by different rules.
7. **Producer size** — each producer's line span, bucketed to the nearest
   50 (minimum bucket 50). The table shows the largest bucket; the
   markdown report lists the distribution and names producers ≥150 lines.
8. **toString purity** — no `this.*` assignments/mutations and no
   register-family calls inside `toString` bodies (it runs multiple
   times). Pass/fail.
9. **No ad-hoc `{ toString }` object literals** — the Stringable
   duck-type that should be a Snippet. Pass/fail, expected zero.
10. **as-casts** — count + sites, excluding `as const`. Expected
    near-zero; each surviving cast requires explicit approval.
11. **Registration channels** — informational: Driver-path `insert*` /
    `defineAndRegister` counts vs raw `register({ definitions })` with
    hand-built Definitions, with sites listed.
12. **No import statements in template literals** — imports are always
    added via register calls. Pass/fail, expected zero.
13. **TODO markers in emitted text** — the stub-scaffold pattern
    (`TODO|FIXME|XXX` in templates). Informational count.
14. **Runtime discipline** — valid synchronous Deno: no node-isms, fs
    APIs, network, timers, or async constructs in generator source; the
    only side effects are logs and register/insert calls. AST-level, so
    async code inside emitted template text is never flagged. Pass/fail.

Checks 1, 5, 8, 9, 12 and 14 are pass/fail facts. The rest are numbers
and per-site listings for human interpretation. The `verdict` column is
a derived **defect aggregate** (`clean` / `warn(m)` / `FAIL(nF+mW)` —
see [`docs/aggregate.md`](docs/aggregate.md)); there is deliberately no
weighted quality score. Full per-check documentation:
[`docs/`](docs/README.md).
Analysis scope is the code the worker bundle executes: root entry files
plus `src/**` (demo/, scripts/, and tests excluded).

## Usage

```bash
# the whole stock-generator suite (skmtc-generators resolved from the
# package location — works from any cwd), one row per generator, one
# column per check:
pnpm stock            # print the table
pnpm stock:save       # also write baselines/stock-latest.{json,md}

# one generator
node src/cli.ts ../../../skmtc-generators/gen-zod

# scan any directory of gen-* packages, write reports
node src/cli.ts --scan <dir> --json out.json --md out.md
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
