# @skmtc/lang-kotlin

SKMTC language package for **kotlin** — _Roadmap_ tier.

Renders: `'.kt'`

**Status: scaffold only.** No implementation yet, and not yet enrolled in
the root `deno.json#workspace` array (kept out of the release cascade
until Phase A development begins).

## Planned contents

Concrete `File` / `Import` / `Identifier` / `Definition` subclasses of
the abstract bases in `@skmtc/core`, the `register` family, this
language's `EntityKind` vocabulary, `sanitizePropertyName`, and syntax
helpers. Rendering lives on each object's own `toString()` — there is no
central renderer object, and `@skmtc/core` never imports from here.

Tests / exercises: top-level fun/val, `as` import aliases, `data class` DTOs, relaxed file-name-vs-class rule, sealed classes

See [`../../notes/lang/`](../../notes/lang/) for the full design.
