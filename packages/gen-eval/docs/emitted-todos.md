# Check 13 — TODO markers in emitted text

**Verdict:** informational (`todo` column: count).

## What it asserts

Template literals (emitted text) carrying `TODO`, `FIXME`, or `XXX`
markers — the stub-scaffold pattern where generated output leaves a
blank for the consumer to fill in.

## Why

`.generated.*` files are overwritten on every run; a consumer edit that
"fills in" a placeholder is silently wiped on the next regenerate. The
skmtc-generator skill's rule: emit complete working output, or don't
emit that piece at all — point an import at a consumer-owned module
instead (the consumer-code seam).

## How it is measured

Case-sensitive `\b(TODO|FIXME|XXX)\b` over template-literal text.
Deliberately narrow: lowercase "placeholder" is NOT matched because
`placeholder="…"` is a legitimate HTML input attribute that form
generators emit constantly.

## Reading the result

Stock baseline: zero. Held informational rather than pass/fail — a
TODO in an emitted *comment* aimed at readers ("TODO: regenerate after
schema change" style guidance) is conceivable — but treat any nonzero
count in harness output as a probable stub-scaffold violation and read
the site.
