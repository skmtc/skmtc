# Task: author `@exp/gen-typebox` — an SKMTC model generator for TypeBox

You are working in a standalone workspace. Author an SKMTC generator
package at `./gen-typebox` that generates TypeBox (`@sinclair/typebox`)
validation schemas for every model (component schema) in
`fixture/openapi.json`.

SKMTC is a code-generation engine: a generator package plugs into its
pipeline and is invoked for each model in the schema. The engine, the
TypeScript language layer (`@skmtc/core`, `@skmtc/lang-typescript`), and
their source are available through this workspace's `deno.json` import map.

## Contract

- `./gen-typebox/mod.ts` default-exports the generator entry; the package
  is named `@exp/gen-typebox` in `./gen-typebox/deno.json`.
- For each model in the fixture, the run must produce a file at
  `@/models/<ModelName>.generated.ts` exporting a TypeBox schema constant
  named after the model in PascalCase, e.g.
  `export const Order = Type.Object({ ... })`.
- A model referenced via `$ref` (e.g. `Address`, used twice by `Order`)
  must be defined exactly once, in its own file, and imported where used.
- Optional properties use `Type.Optional(...)`; nullable strings may use
  `Type.Union([Type.String(), Type.Null()])`; string enums may use
  `Type.Union([Type.Literal('a'), ...])`.

## Verify

Run `deno task verify` — it runs the engine over the fixture with your
generator, writes artifacts to `out/`, and typechecks them. Success means:
verify exits 0, all four model files exist under `out/models/`, and they
compile.

Do not edit `harness.ts`, `fixture/`, `deno.json`, or `check.deno.json` —
they are the fixed test rig. Work only inside this directory (the
generator itself lives in `./gen-typebox`). When you are done, print DONE
plus a one-paragraph summary of your approach.

## Working method
After each meaningful change, run `deno task verify` and read its output
before continuing.
