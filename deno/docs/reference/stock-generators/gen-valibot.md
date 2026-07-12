# @skmtc/gen-valibot

> Produce Valibot validation schemas from OpenAPI schemas.

A model generator. The Valibot analog of `gen-zod`. Same entry
shape, different library. Use when your project standardizes on
Valibot for its tree-shaking advantages or its functional API.

## What it generates

For a `User` schema:

```ts
import * as v from 'valibot'

export const user = v.object({
  id: v.string(),
  name: v.string(),
  email: v.optional(v.string()),
})
```

The entry is identical to `gen-zod`:

```ts
export const valibotEntry = toModelEntry({
  id: denoJson.name,
  transform({ context, refName }) {
    context.insertModel(ValibotProjection, refName)
  }
})
```

All variation lives in `ValibotProjection` and the per-variant
classes.

## Source

`skmtc-generators/gen-valibot/src/`

## Key decisions

- **`import * as v from 'valibot'`** as the canonical namespace.
  This is a Valibot convention — pipes (`v.pipe(...)`) compose
  better with the namespace prefix than with named imports.
- **Functional composition.** Valibot's API is function-based, not
  method-chained: `v.pipe(v.string(), v.email())` rather than
  `z.string().email()`. The Projection structure follows.
- **Modifier helpers similar to gen-zod.** Optional and nullable
  wrap as `v.optional(...)` / `v.nullable(...)` — function calls,
  not chains.

## What to learn from it

- **How to fork a model generator to a different library.** Compare
  the entry shapes (identical) and the Projection shapes (matching
  structure, swapped library calls). This is the cleanest
  illustration of the "Projection holds the variation" pattern.
- **Library-API impedance.** Zod's method chains vs Valibot's
  functional pipes require different rendering styles. The
  Projection class names and dispatch don't change — only what each
  class's `toString()` produces does.

## Common customizations when cloned

- Add custom pipe steps (e.g., `v.transform(...)` for
  format-specific parsing).
- Tweak the namespace alias (`v` vs `vb` vs explicit named imports).
- Change how complex constraints compose (Valibot's pipe semantics
  give you more options than Zod's method chains).

## See also

- [gen-zod](gen-zod.md) — closest analog; read alongside
- [gen-arktype](gen-arktype.md) — another validation library
- [OasSchema variants reference](../api/oas-schema-variants.md)
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
