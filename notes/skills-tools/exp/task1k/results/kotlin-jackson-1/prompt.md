# Task: author `@exp/gen-kotlin-jackson` — an SKMTC model generator for Kotlin + Jackson

You are working in a standalone workspace. Author an SKMTC generator
package at `./gen-kotlin-jackson` that generates Kotlin data classes
with Jackson annotations for every model (component schema) in
`fixture/openapi.json`.

SKMTC is a code-generation engine: a generator package plugs into its
pipeline and is invoked for each model in the schema. The engine and the
Kotlin language layer (`@skmtc/core`, `@skmtc/lang-kotlin`) are
available through this workspace's `deno.json` import map.

## Contract

- `./gen-kotlin-jackson/mod.ts` default-exports the generator entry;
  the package is named `@exp/gen-kotlin-jackson` in
  `./gen-kotlin-jackson/deno.json`.
- Every model renders to `@/com/example/models/<Name>.generated.kt`
  with `package com.example.models`. The Kotlin package is FIXED for
  this task — hardcode the path policy; no enrichment configuration is
  provided at runtime.
- An object model becomes a `data class <Name>(...)` (PascalCase from
  the schema name). A string enum becomes an `enum class`. Jackson must
  be able to read the wire format: if an enum entry's name differs from
  the wire value, annotate the entry.
- Properties are camelCase Kotlin names. When the Kotlin name differs
  from the wire key (e.g. `unit_price` → `unitPrice`), annotate with
  `@JsonProperty("<wire key>")` from
  `com.fasterxml.jackson.annotation`. A property whose sanitized name
  still matches its wire key (e.g. the hard keyword `object`, backticked)
  needs no annotation.
- A property that is optional (absent from `required`) or nullable
  renders as `Type? = null` — the type expression owns the single `?`.
- A model referenced via `$ref` (e.g. `Address`, used twice by `Order`)
  is defined exactly once, in its own file, and referenced by type name.
  All models share one package, so no cross-model imports should appear.
- The self-recursive model (`Category`) must render
  `children: List<Category>? = null`.

## Verify

Run `deno task verify` — it runs the engine over the fixture with your
generator, writes artifacts to `out/`, and structurally checks the
Kotlin (`kotlin-checks.mjs` prints any failures). Success means verify
exits 0.

Do not edit `harness.ts`, `kotlin-checks.mjs`, `fixture/`, or
`deno.json` — they are the fixed test rig. Work only inside this
directory (the generator itself lives in `./gen-kotlin-jackson`). When
you are done, print DONE plus a one-paragraph summary of your approach.

## Working method
Before writing any code, invoke the skill `skmtc-model-v3`, then
`skmtc-generator-v3`, then `skmtc-lang-kotlin-v3`, and follow them. The
model-v3 skeleton emits TypeScript — keep its SHAPE and edge-case
handling, but take every Kotlin call shape from skmtc-lang-kotlin-v3.
After each meaningful change, run `deno task verify` and read its output
before continuing.
