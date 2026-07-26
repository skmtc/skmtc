# skmtc-generator-v2 — common errors

The recurring wrong guesses. Each entry: the move that feels right →
why the instinct fires → what is true instead. If a diagnostic or a
review comment surprised you, look for it here before debugging.

## Checked whether a definition exists before inserting

*Instinct:* defensive programming — creating a duplicate would be a
bug anywhere else.
*Here:* insertion is memoized on `(identifier.name, exportPath)`;
`insert*` IS the check. A guard re-implements the uniqueness
guarantee and can diverge from it. Delete the guard; call `insert*`
unconditionally.

## Constructed or inserted inside `toString()`

*Instinct:* lazy evaluation — build it when it's needed for output.
*Here:* Render reads settled state; declaration after Generate ends
breaks the placement and settlement guarantees (the dependency can no
longer land above you, its import can no longer be stitched). Build
the whole render tree in the constructor; `toString()` only
interpolates fields that already exist.

## Wrote a file with `Deno.writeFileSync`

*Instinct:* the task is "produce a file", so produce a file.
*Here:* a disk write bypasses the engine's file map — the content is
invisible to the cache, the manifest, other generators, and the
Render phase (and stale copies survive `clean`). Files come from
`register` / `registerJson` / `registerMarkdown` with a
`destinationPath`; the engine does all disk I/O.

## Returned `{ toString: () => '...' }` where a producer belongs

*Instinct:* it satisfies the `Stringable` type, and it's shorter than
a class.
*Here:* the duck type lies about capabilities — it has no context, no
register, no live properties for a parent to reach into. A stringable
fragment is a Snippet (extend the lang snippet base), even a
three-line one.

## Concatenated pre-rendered strings during Generate

*Instinct:* the fragment is ready, join it now.
*Here:* calling `toString()` early and gluing the results collapses
the tree before the engine (and other producers) are done with it.
Hold objects in `Stringable` fields and interpolate them in your own
`toString()`; the collapse happens once, at Render. (§7 of the skill
— when in doubt, assume it will be built upon.)

## Read `schema.type` outside the router

*Instinct:* a quick local branch is simpler than routing.
*Here:* mapping is decided in exactly one place — the
`SchemaToValueFn` router, one case per schema type. A second dispatch
site means two places to keep aligned and is rejected by the
structural checks. Pass the schema to the router and use the typed
value it returns; per-type decisions (annotations, defaults, format
forks) live inside the case that owns them.

The subtle variant: a **presence guard** written as a type test.
`schema.type === 'custom'` (or `'void'`, or any schema-type literal)
to check "does this value carry wire facts?" is still a dispatch in
the checks' eyes — the literal set covers the full schema-type
vocabulary, not just the cases you think of as routing. Read facts
with the `in` operator instead: `'readOnly' in schema &&
schema.readOnly`.

## Proposed "run generator X first" / a priority / a pre-pass

*Instinct:* dependencies need ordering.
*Here:* there is no run order — each producer creates or reuses its
dependencies at the moment of need, synchronously, so any visit order
yields identical output. An ordering proposal always signals a
misread of §4; the fix is an `insert*` call at the point of need.

## Presence-checked a Nullable-generic field with `!== undefined`

*Instinct:* optional fields are `T | undefined`.
*Here:* several OAS IR fields — `OasObject.properties`, `enums`,
`default`, `example` — are `T | null | undefined`. The `!== undefined`
guard lets `null` through and the code downstream throws. Use
truthiness: `if (schema.properties) { ... }`.

## Hit `Registered definition mismatch` and reached for a dedupe

*Instinct:* two things claimed the same name, so filter one out.
*Here:* the error means one `(name, exportPath)` slot was claimed by
two different generator identities — an identity-config collision,
not a duplication bug. Fix `toIdentifierName` / `toExportPath` so the
two outputs land under distinct keys (or the same generator produces
both); never intercept or filter registrations.

## Emitted an import statement inside a template literal

*Instinct:* the output file needs the import, so print it.
*Here:* imports are data, not text — declare them via
`register({ imports })` and the File renders one deduplicated,
merged header. A printed import escapes dedup and collides with the
engine-stitched ones. (Registering an import for a hand-written
consumer-side module is fine — that is the seam for generated code
referencing non-generated code.)

## Threaded config through the value tree

*Instinct:* the leaf needs the option, so pass it down.
*Here:* enrichments arrive parsed on `settings.enrichments`, and
context is already on every producer. Read config at the point of
need; adding an owner/config parameter to every constructor between
the top and the leaf is plumbing the engine already did for you.
Where a parent and child must see one collection, share the
reference (`this.annotations = this.value.annotations`) — never copy.

## `cd`-ed into the project to run checks

*Instinct:* commands run from the directory they concern.
*Here (agent-operational):* the Bash tool's cwd persists across
calls, so a bare `cd` leaves later commands running somewhere
unexpected — a classic phantom-error spiral. Use a subshell:
`(cd .skmtc/<project> && deno check <gen>/mod.ts)`.
