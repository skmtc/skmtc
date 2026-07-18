# Check 4 — String composition happens inside toString

**Verdict:** informational (`str-outside` column: node count + share).

## What it asserts

The main composition logic renders through producers' `toString()`
template literals. Significant string building *outside* toString means
helper functions are doing the composition and producers are reduced to
pass-throughs.

## Why

Snippets exist to make functionality shareable and reusable; each
renders itself via `toString()`. Strings built in helper modules can't
register their own imports, aren't attributable, and bypass the
`Stringable` composition contract.

## How it is measured

Three node kinds count as string composition: template expressions
(with `${}` substitutions), string `+`/`+=` concatenation, and `.join()`
property calls (`join('@', …)` from `@std/path` is a bare call and is
not counted). Plain string literals are never counted.

Each node is attributed to its lexically enclosing function and
bucketed:

- **inside toString** — any frame in the enclosing chain is a
  `toString` method (arrows nested in toString count as inside)
- **naming statics** — inside `toIdentifierName` / `toExportPath` /
  `toPackageName`; expected, excluded from the share
- **outside** — everything else

`outsideShare = outsideChars / (insideToStringChars + outsideChars)`.
The top outside sites (file + function, by chars) are listed.

## Reading the result

The clean stock cohort sits at roughly 3–30% outside share. 70%+ means
a helper-module composition style (`gen-typescript-sdk`, `gen-arktype`,
`gen-csharp` in the baseline). Some outside composition is useful or
unavoidable — constructors computing small labels, error messages — so
read the top sites, not just the number.

## Known exceptions

Constructor-computed fragments stored on `this` for a pure toString are
legitimate and land in "outside"; they are typically small. The signal
is *large* helper functions dominating the top-site list.
