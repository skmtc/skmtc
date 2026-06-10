# @skmtc/gen-zod

> Produce Zod validation schemas from OpenAPI schemas.

A model generator. Produces `export const userBody = z.object({...})`
runtime schemas — the validation counterpart to `gen-typescript`'s
static types. Most production setups run them together.

## Source

`skmtc-generators/gen-zod/src/`

## What it generates

For a `User` schema:

```ts
import { z } from 'zod'

export const user = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
})
```

Per-variant classes (`ZodObject`, `ZodArray`, `ZodString`,
`ZodInteger`, `ZodNumber`, `ZodBoolean`, `ZodUnion`, `ZodVoid`,
`ZodUnknown`) handle the dispatch. The recursive structure mirrors
`OasSchema`.

## Key decisions

- **Lowercase identifier names.** `export const user` (not `User`)
  to distinguish from the TypeScript-type equivalent `User`. This
  is the load-bearing decision that makes mixed-import rendering
  work (`import { user, type User } from ...`).
- **Modifier composition via helpers.** `withNullable` and
  `withOptional` (in `src/`) wrap a base schema's `toString()` with
  `.nullable()` / `.optional()` chains. The `applyModifiers`
  function applies both based on the OasSchema's flags.
- **Per-variant constraint rendering.** `ZodConstraints.ts`
  centralizes the per-variant constraint-rendering logic
  (`.min(...)`, `.max(...)`, `.email()`, `.uuid()`, etc.) so each
  variant class doesn't reimplement it.
- **`ZodRef` is its own class.** Refs aren't an `OasSchema` variant
  but they're a render case — `ZodRef.ts` handles the
  "reference to a previously-registered Zod schema" path.

## What to learn from it

- **The canonical schema-renderer shape.** Look at `ZodProjection.ts`
  to see the `toZodValue` dispatch and how each variant class is
  invoked. The pattern transfers directly to Valibot, ArkType, or
  any other validation library.
- **Modifier composition.** The `withNullable`/`withOptional`
  pattern keeps the variant classes focused on their core
  representation; nullability and optionality wrap on top.
- **Constraint rendering separated from type rendering.** The split
  between "this is a string" (`ZodString`) and "this string has
  `.min(8).max(64)`" (`ZodConstraints`) keeps both halves readable.

## Common customizations when cloned

- Add Zod features the stock doesn't render (e.g., `.refine(...)`
  predicates for custom validation).
- Map custom OpenAPI `format` values to Zod's specialized methods
  (e.g., `format: 'uri'` → `z.string().url()`).
- Change identifier casing (the lowercase decision is a
  customization seam — some teams prefer `UserSchema` over `user`).
- Replace `z.object({...})` with `z.strictObject({...})` if you
  want unknown-key rejection.

## See also

- [gen-typescript](gen-typescript.md) — sibling model generator;
  typical combo
- [gen-valibot](gen-valibot.md) — same pattern, different library
- [gen-arktype](gen-arktype.md) — same pattern, different library
- [OasSchema variants reference](../api/oas-schema-variants.md) —
  what `toZodValue` dispatches over
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
