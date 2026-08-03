# Task: author `@exp/gen-effect-schema` — an SKMTC model generator for effect/Schema

You are working in a standalone workspace. Author an SKMTC generator
package at `./gen-effect-schema` that generates effect Schema
(`import { Schema } from 'effect'`) validation schemas for every model
(component schema) in `fixture/openapi.json`.

SKMTC is a code-generation engine: a generator package plugs into its
pipeline and is invoked for each model in the schema. The engine, the
TypeScript language layer (`@skmtc/core`, `@skmtc/lang-typescript`), and
their source are available through this workspace's `deno.json` import map.

## Contract

- `./gen-effect-schema/mod.ts` default-exports the generator entry; the
  package is named `@exp/gen-effect-schema` in
  `./gen-effect-schema/deno.json`.
- For each model in the fixture, the run must produce a file at
  `@/models/<ModelName>.generated.ts` exporting an effect Schema constant
  named after the model in PascalCase, e.g.
  `export const Order = Schema.Struct({ ... })`.
- A model referenced via `$ref` (e.g. `Address`, used twice by `Order`)
  must be defined exactly once, in its own file, and imported where used.
- Optional properties use `Schema.optional(...)`; nullable strings may
  use `Schema.NullOr(...)`; string enums may use
  `Schema.Literal('a', 'b', ...)`; a self-recursive model (`Category`)
  may use `Schema.suspend((): Schema.Schema<any> => Category)` and must
  typecheck.

## Verify

Run `deno task verify` — it runs the engine over the fixture with your
generator, writes artifacts to `out/`, and typechecks them. Success means:
verify exits 0, all five model files exist under `out/models/`, and they
compile.

Do not edit `harness.ts`, `fixture/`, `deno.json`, or `check.deno.json` —
they are the fixed test rig. Work only inside this directory (the
generator itself lives in `./gen-effect-schema`). When you are done,
print DONE plus a one-paragraph summary of your approach.

## Working method
After each meaningful change, run `deno task verify` and read its output
before continuing.
