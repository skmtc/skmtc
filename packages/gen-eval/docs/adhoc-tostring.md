# Check 9 — No ad-hoc `{ toString }` object literals

**Verdict:** pass/fail (`adhoc` column). These should not exist at all.

## What it asserts

No object literal anywhere in the generator declares a `toString`
property or method — the duck-type that satisfies `Stringable` while
lying about capabilities.

## Why

An ad-hoc `{ toString: () => '…' }` has no `context` (it can never
register an import), no `generatorKey` (invisible to attribution and
`affirmDefinition`), and is not `instanceof SnippetBase` (rejected by
generic code over the producer family). Anything stringable should be a
Snippet — or `CustomValue` for a raw fragment.

## How it is measured

Any `ObjectLiteralExpression` containing a property assignment or
method named `toString`, anywhere in non-test source. Site (file,
enclosing function, line) is recorded.

## Reading the result

Expected: zero. The stock baseline caught three offenders —
`gen-arktype`'s `ArktypeObject` (a
`{ toString: () => 'type("unknown")' } as TypeSystemValue`, which also
trips check 10), `gen-reapit-form` (2 sites), and
`gen-reapit-graphql-client` (1) — all genuine, all fixable by a small
Snippet or `CustomValue`.

## Known exceptions

None in generator source. If a false positive ever appears (an object
literal legitimately carrying a `toString` key into an external API),
flag it for an explicit allow-list rather than weakening the check.
