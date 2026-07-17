# Check 12 — No import statements in template literals

**Verdict:** pass/fail (`tpl-imp` column). Imports are always added via
register calls.

## What it asserts

No template literal in generator source contains an `import … from` (or
side-effect `import '…'`) statement as emitted text.

## Why

An import written into a template lands in the *body* of the rendered
file — after the imports header `File.toString()` produces — so
TypeScript rejects it. It also bypasses the per-module `Set` dedup and
the identifier-kind-aware rendering (`import type` vs `import`). The
register family is the only import channel:
`this.register({ imports })` (own file), `this.registerInto(path, { imports })`
(cross-file), `this.register({ imports, destinationPath })` (Snippet).

## How it is measured

Every template literal's text is tested against
`/^\s*import\b(.*\bfrom\b|\s+['"])/m`. AST-level template nodes only —
so the word "import" in a doc comment or a plain string is not matched.

## Reading the result

Expected: zero — the entire stock baseline passes. Any hit in harness
output is the classic training-data anti-pattern and maps directly to
the skmtc-generator skill's "Raw `import` statements in template
literals" rule.

## Known exceptions

None. A generator emitting *documentation about* imports (markdown
docs generators) could theoretically false-positive; none does today —
if one appears, allow-list the site rather than weakening the regex.
