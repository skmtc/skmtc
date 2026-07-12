# @skmtc/gen-typescript

> Produce TypeScript `type` aliases from OpenAPI schemas and GraphQL types.

A model generator (one Projection per schema component). Produces
`type` aliases — not interfaces, not classes — so the output
composes cleanly with structural-typing-heavy codebases.

## What it generates

For a `User` schema:

```ts
export type User = {
  id: string
  name: string
  email?: string
}
```

Per OAS-schema-variant TS classes (`TsObject`, `TsArray`,
`TsString`, etc.) handle the dispatch. The `toTsValue` function in
`src/Ts.ts` is the central switch from `OasSchema.type` to the
right TS class.

## Source

`skmtc-generators/gen-typescript/src/`

## Key decisions

- **Type aliases, not interfaces.** `type User = {...}` rather than
  `interface User {...}`. Type aliases compose better with mapped/
  conditional types and don't suffer from declaration merging
  surprises.
- **Configurable scalar map** via a factory function:
  `toTypescriptEntry({ scalars: {...}, replaceScalars: false })`.
  Keys match OpenAPI `format` strings (`'date-time'`, `'email'`) or
  GraphQL custom-scalar names (`'DateTime'`, `'JSON'`). The default
  map covers common formats; user overrides merge on top unless
  `replaceScalars: true`.
- **Module-level scalar state.** Calling `toTypescriptEntry`
  mutates module-level scalar state via `setCustomScalars`. Fine
  for the typical "one generation pipeline per process" model;
  parallel pipelines with different scalar maps would need to run
  sequentially.

## What to learn from it

- **The model-generator template** — minimal entry, all the
  variation lives in the Projection.
- **Per-OasSchema-variant sibling classes** — `TsObject`,
  `TsString`, etc., each handling their own `toString()`. This
  mirrors the `OasSchema` discriminated union and is the canonical
  way to write a schema renderer.
- **Factory-function config as an alternative to enrichments.** When
  the config is global (scalar map) rather than per-operation, a
  factory function is cleaner than the per-operation enrichments path.

## Common customizations when cloned

- Add new scalar mappings (a custom domain type like `Money` or
  `ISBN`).
- Change `type` to `interface` if your codebase prefers interfaces
  (e.g., for declaration merging with hand-written extensions).
- Tweak how `nullable` is represented (`T | null` vs `T | undefined`
  vs a custom `Nullable<T>` alias).
- Customize export paths (default lives in `src/base.ts`).

## See also

- [Projection bases reference](../api/projection-bases.md) — what
  the scaffold extends
- [OasSchema variants reference](../api/oas-schema-variants.md) —
  what `toTsValue` dispatches over
- [gen-zod](gen-zod.md) — sibling model generator with identical
  entry shape
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
