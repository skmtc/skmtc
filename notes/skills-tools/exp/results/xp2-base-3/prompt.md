# Task: author `@exp/gen-api-client` — a tag-grouped API client generator

You are working in a standalone workspace. Author an SKMTC generator
package at `./gen-api-client` that generates a typed fetch client from
the OpenAPI document in `fixture/openapi.json`.

SKMTC is a code-generation engine: a generator package plugs into its
pipeline and is invoked per subject of the schema. `@skmtc/core`,
`@skmtc/lang-typescript`, and the stock model generator `@skmtc/gen-zod`
are wired in this workspace's `deno.json`.

## Contract

- `./gen-api-client/mod.ts` default-exports the generator entry; the
  package is named `@exp/gen-api-client` in `./gen-api-client/deno.json`.
- **One class per tag**: every operation tagged `orders` becomes a method
  on a single `OrdersClient` class in `@/client/OrdersClient.generated.ts`;
  same pattern for `addresses` (`AddressesClient`). A tag's class and
  file must be created once, no matter how many operations share the tag.
- **One method per operation**, named from the method + path (e.g.
  `GET /orders/{id}` → `getOrdersId` or similar deterministic scheme —
  do not use operationId). Path parameters become method parameters; the
  path is templated into the `fetch` call; POST bodies are passed and
  JSON-stringified.
- **Responses are validated with zod schemas produced by
  `@skmtc/gen-zod`**: each method returns
  `<zodSchema>.parse(await res.json())` where `<zodSchema>` is the
  schema constant for the operation's response model, produced through
  gen-zod's projection via the engine (the schema definitions must land
  in their own files and be imported into the client files — do NOT
  write zod schema text by hand and do NOT hand-write those imports).
  A model used by several operations must be defined exactly once.

## Verify

Run `deno task verify` — it runs the engine over the fixture with your
generator, writes artifacts to `out/`, and typechecks them. Success:
verify exits 0; `out/client/OrdersClient.generated.ts` (3 methods) and
`out/client/AddressesClient.generated.ts` (1 method) exist; the zod
model files exist under `out/`; everything compiles.

Do not edit `harness.ts`, `fixture/`, `deno.json`, or `check.deno.json`.
Work only inside this directory (the generator lives in
`./gen-api-client`). When done, print DONE plus a one-paragraph summary.

## Working method
After each meaningful change, run `deno task verify` and read its output
before continuing.
