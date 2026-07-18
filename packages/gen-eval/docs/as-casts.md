# Check 10 — as-cast count

**Verdict:** count (`as` column), expected near-zero; each surviving
cast is an edge case requiring explicit approval.

## What it asserts

Production generator code narrows via type guards and discriminants
(`.isRef()`, `schema.type`), not `as` casts. `as const` assertions are
excluded — they are erasable and idiomatic.

## Why

`as` bypasses the type system exactly where SKMTC's union-based schema
model (`OasSchema | OasRef<'schema'>`) is designed to force narrowing.
The codebase convention reserves `as` for tests. Occasional edge cases
may be genuinely unavoidable — the policy is not zero-tolerance but
**approval-per-cast**: every site is listed with its text so a human
can sign off.

## How it is measured

Every `AsExpression` whose type is not a const-type reference, in
non-test source. Old-style angle-bracket assertions are not counted
(they cannot appear in `.tsx`-parsed source). Up to 12 sites are
reported with file, enclosing function, line, and the cast text
(truncated to 80 chars).

## Reading the result

The stock baseline scatters 0–3 per generator. In harness output, read
each site: a cast working around a genuinely absent narrowing API may
pass review; a cast silencing a schema-union error is a bug and usually
co-occurs with check 9 (`gen-arktype`'s
`{ toString: … } as TypeSystemValue` trips both).
