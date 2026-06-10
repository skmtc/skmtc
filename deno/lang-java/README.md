# @skmtc/lang-java

SKMTC language package for **java** — _Stress-test_ tier.

Renders: `'.java'`

**Status: scaffold only.** No implementation yet, and not yet enrolled in
the root `deno.json#workspace` array (kept out of the release cascade
until Phase A development begins).

## Planned contents

Concrete `File` / `Import` / `Identifier` / `Definition` subclasses of
the abstract bases in `@skmtc/core`, the `register` family, this
language's `EntityKind` vocabulary, `sanitizePropertyName`, and syntax
helpers. Rendering lives on each object's own `toString()` — there is no
central renderer object, and `@skmtc/core` never imports from here.

Tests / exercises: file basename = public class name, no import aliases, one public class per file

See [`../../notes/lang/`](../../notes/lang/) for the full design.
