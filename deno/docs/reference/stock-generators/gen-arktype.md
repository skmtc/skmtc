# @skmtc/gen-arktype

> Produce ArkType validation schemas from OpenAPI schemas.

A model generator. The ArkType analog of `gen-zod` and `gen-valibot`.
Use when your project prefers ArkType's TypeScript-syntax-mirroring
DSL over method chains or pipes.

## Source

`skmtc-generators/gen-arktype/src/`

## What it generates

For a `User` schema:

```ts
import { type } from 'arktype'

export const user = type({
  id: 'string',
  name: 'string',
  'email?': 'string',
})
```

The entry is identical to `gen-zod` and `gen-valibot`:

```ts
export const arktypeEntry = toModelEntry({
  id: denoJson.name,
  transform({ context, refName }) {
    context.insertModel(ArktypeProjection, refName)
  }
})
```

## Key decisions

- **String DSL for primitives.** ArkType expresses
  `'string'`, `'number'`, `'integer'` as string literals rather
  than function calls. The Projection produces these literally — a
  notable departure from Zod/Valibot's function-call style.
- **Optional marker via key suffix.** `'email?'` (with the literal
  `?` in the key) is how ArkType marks optional fields. The
  Projection handles this at the object-rendering level rather than
  via a modifier wrapper.
- **`as const` not needed** — ArkType infers from the literal types
  directly.

## What to learn from it

- **A different validation library has different idioms.** Where
  Zod uses `.optional()` and Valibot uses `v.optional(...)`,
  ArkType uses a key-name suffix. The OasSchema-variant dispatch
  structure stays the same; the rendering style changes.
- **Generator-level decisions vs library-level decisions.** The
  decision to mark optional via key suffix vs wrapper isn't the
  Projection's choice — it's ArkType's API. The Projection just
  mirrors what the target library wants.

## Common customizations when cloned

- Add ArkType-specific features the stock skips (e.g., scope
  composition, narrows, morphs).
- Change how `nullable` is encoded (ArkType supports several
  options).
- Tweak the import shape (`{ type }` vs `* as a`).

## See also

- [gen-zod](gen-zod.md) — the canonical model-generator template
- [gen-valibot](gen-valibot.md) — another sibling
- [OasSchema variants reference](../api/oas-schema-variants.md)
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
