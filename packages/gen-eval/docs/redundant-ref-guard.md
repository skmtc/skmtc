# Check 15 — No redundant `isRef()` guards around `resolve()`

**Verdict:** count, warning-level (each site counts toward `warn(m)`).

## What it asserts

`.resolve()` is called unconditionally. The pattern

```ts fragment
const resolved = schema.isRef() ? schema.resolve() : schema
```

is flagged; the correct form is

```ts fragment
const resolved = schema.resolve()
```

## Why

Every concrete `Oas*` schema class implements `resolve()` (and
`resolveOnce()`) as `return this` — resolution is identity on
everything except an actual `OasRef`. The guard therefore encodes a
false belief about the API (that `resolve()` only exists on refs, or
that calling it on a concrete schema is wasteful or unsafe), and each
occurrence propagates that belief to the next reader. `.isRef()` is
for **genuine branching** — where the two branches do different
things, e.g. `toRefName()` (a method only refs have) versus a
fallback name.

## How it is measured

A conditional expression whose condition is a call to `X.isRef()`,
where one branch is `X.resolve()` or `X.resolveOnce()` and the other
branch is `X` itself (textually identical subject), in either branch
order. Only this exact identity shape matches — legitimate `.isRef()`
ternaries (different logic per branch) are never flagged. The
`if`/`else` statement form of the same redundancy is not detected.

## Reading the result

Each site lists file, line, enclosing scope, and the guarded
expression. The fix is mechanical: replace the whole ternary with the
`.resolve()` call. There are no known legitimate exceptions.
