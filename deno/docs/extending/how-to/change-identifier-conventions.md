# How to change identifier conventions

> Change the naming convention for generated identifiers in a
> cloned generator (e.g., `user` → `UserSchema`, `useGetUser` →
> `useUserQuery`).

## When to use this

You want the generated identifiers to match your team's naming
conventions instead of the stock generator's defaults.

## Prerequisites

- The generator cloned into your project ([tutorial: cloning](../tutorials/01-cloning-a-generator.md)).
- Light understanding of [identifiers and entity types](../../reference/api/dsl-identifier.md).

## Steps

### Open `gen-x/src/base.ts`

`toIdentifier` lives there. It returns an `Identifier` (not a
plain string) carrying both the name AND the entity-type marker.

### Edit `toIdentifier`

Always use `Identifier.createVariable` or `Identifier.createType`
— **never** return a raw string.

```ts
import { Identifier } from '@skmtc/core'

// gen-zod default
toIdentifier: ({ refName }) => Identifier.createVariable(decapitalize(refName))
// → "user", "order", "pet"

// Your house style: PascalCase with suffix
toIdentifier: ({ refName }) => Identifier.createVariable(`${refName}Schema`)
// → "UserSchema", "OrderSchema", "PetSchema"

// For a type generator
toIdentifier: ({ refName }) => Identifier.createType(refName)
// → rendered as `export type User = ...` and imports as `import { type User }`
```

The `createVariable` vs `createType` choice determines:

- The declaration shape (`export const` vs `export type`)
- The import shape under `verbatimModuleSyntax: true`
  (`import { X }` vs `import { type X }`)

See [identifier reference](../../reference/api/dsl-identifier.md)
for the entity-type semantics.

### Preserve uniqueness across operations

The `(identifier.name, exportPath)` pair is the cache key. If
two operations within your generator produce the same name in
the same file, the Driver's `affirmDefinition` detects the
mismatch (different `generatorKey` per operation) and throws
`Registered definition mismatch`. Re-inserting the same operation
is idempotent (same key → cache hit).

Make sure your naming function produces unique names per
operation/refName so the throw never fires. Helpers like
`toEndpointName(operation)` handle the OAS-spec quirks (missing
`operationId`, identical paths with different methods).

### Rebundle and regenerate

```bash
skmtc bundle my-project
skmtc generate my-project
```

## Verification

Open an generated file and check the declarations:

```bash
cat src/generated/Pet.generated.ts | head -3
# export const PetSchema = z.object({...})    ← new naming
```

Cross-generator references (e.g., a form generator importing the
Zod schema) follow the new name automatically — they discover
it via `insertModel(...).toName()`, not by hardcoded reference.

## Troubleshooting

- **`Identifier.createVariable is not a function`** — you might be
  using `new Identifier({...})` directly. The factory methods are
  the recommended path. Direct construction works but is rarer
  (and easier to get wrong).
- **Imports break under `verbatimModuleSyntax`** — A `type`
  identifier registered as `createVariable` (or vice versa) causes
  TS errors. Audit which generators produce values vs types and
  make sure each is right.
- **Same identifier name across operations** — naming function
  isn't unique enough. Common bug: derivation from `operation.summary`
  rather than `operationId` (summaries are free text and not
  required to be unique).

## Related

- [API: Identifier](../../reference/api/dsl-identifier.md) —
  including the entity-type discussion
- [How to change export paths](change-export-paths.md) — the
  sibling task
- [How idempotency works](../../explanation/how-idempotency-works.md) —
  why uniqueness matters
