# @skmtc/lang-rust

SKMTC language package for **rust** — _Stress-test_ tier.

Renders: `'.rs'`

**Status: scaffold only.** No implementation yet, and not yet enrolled in
the root `deno.json#workspace` array (kept out of the release cascade
until Phase A development begins).

## Planned contents

Concrete `File` / `Import` / `Identifier` / `Definition` subclasses of
the abstract bases in `@skmtc/core`, the `register` family, this
language's `EntityKind` vocabulary, `sanitizePropertyName`, and syntax
helpers. Rendering lives on each object's own `toString()` — there is no
central renderer object, and `@skmtc/core` never imports from here.

Tests / exercises: native tagged enums (matches oneOf), `use` paths, `pub` visibility

See [`../../notes/lang/`](../../notes/lang/) for the full design.
