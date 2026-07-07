# Definition (DefinitionBase & TsDefinition)

> The named, exportable wrapper around a Projection's generated value
> — the bridge between a Projection (unit of output) and a File
> (rendered output). Split across the language seam: the neutral
> coordination surface (`DefinitionBase`) lives in core; the
> TypeScript rendering (`TsDefinition`) lives in
> `@skmtc/lang-typescript`. Created automatically by Drivers; rarely
> instantiated directly.

## Source

- `skmtc/deno/core/dsl/Definition.ts` — `DefinitionBase` (abstract)
- `skmtc/deno/lang-typescript/src/TsDefinition.ts` — `TsDefinition`

(Core's concrete TS-rendering `Definition` was deleted under F5/F6 —
`notes/lang/17-naming-layer-and-helpers-move.md`. `TsDefinition`
renders byte-identically to it.)

## DefinitionBase (`@skmtc/core`) — the coordination surface

```ts
abstract class DefinitionBase<V extends GeneratedValue = GeneratedValue> extends SnippetBase {
  identifier: Identifier
  value: V

  constructor(args: { context: GenerateContextType; identifier: Identifier; value: V })

  abstract toString(): string
}
```

The cross-generator cache reads only this surface — the definition's
`identifier` (the `(name, exportPath)` cache key), its `value`, and
the `generatorKey` (via `SnippetBase`) for the integrity check. How a
definition renders — the `export const X = ...` wrapper, JSDoc, the
visibility keyword — is the concrete language subclass's concern.

Engine code types against the base: `findDefinition` returns
`DefinitionBase | undefined`; `context.register({ definitions })`
accepts `DefinitionBase[]`; `insertNormalizedModel` returns
`DefinitionBase<V>`; `GeneratedDefinition<V> = DefinitionBase<V>`.

## TsDefinition (`@skmtc/lang-typescript`) — the TypeScript renderer

```ts
class TsDefinition<Value extends GeneratedValue = GeneratedValue> extends DefinitionBase<Value> {
  description: string | undefined
  noExport: boolean | undefined

  constructor(args: {
    context: GenerateContextType
    identifier: Identifier
    value: Value
    description?: string   // optional JSDoc text
    noExport?: boolean     // omit the `export` keyword
  })

  override toString(): string
}
```

`toString()` assembles the declaration:

1. Optional JSDoc block (from `description`, via `withDescription`)
2. `export` keyword (unless `noExport`)
3. Declaration keyword from the identifier's `kind`
   (`toTsKeyword`: `'variable'` → `const`, `'type'` → `type`)
4. Identifier name (with optional `: typeName` annotation)
5. `=`, the value (stringified via template interpolation), `;\n`

Output examples:

```ts
// kind 'variable', no typeName
export const userBody = z.object({ name: z.string() });

// kind 'variable' with typeName
export const useCreateUser: UseMutationResult<UserData, Error, CreateUserArgs> = (...) => { ... };

// kind 'type'
export type UserBody = { name: string; email: string };

// with description
/** The validated request body for creating a user. */
export const createUserBody = z.object({ ... });

// noExport (rare)
const _privateHelper = (...) => { ... };
```

## How Drivers create Definitions

Drivers never name a concrete class — they read the `Lang` off the
projection class's inherited static and use its factory:

```ts
// In ModelDriver / OasOperationDriver / GqlOperationDriver (simplified)
const cached = context.findDefinition({ name, exportPath })
if (cached && affirmDefinition(cached)) return cached

const value = new this.projection({ ... })          // construct the Projection
const definition = this.projection.lang.toDefinition({
  context, identifier, value, noExport
})                                                   // → a TsDefinition for TS generators

context.register({ definitions: [definition], destinationPath: exportPath })
```

When the file is later serialized, `definition.toString()` runs,
which interpolates `value` — the Projection's `toString()` — between
`export const NAME = ` and `;`.

## When to create a definition directly

Rare. For a one-off sibling declaration in a file you own (a
constants object, a default-values map), use the lang package's
`defineAndRegister` function — it builds the `TsDefinition` and
registers it in one step:

```ts fragment
import { defineAndRegister, createVariable } from '@skmtc/lang-typescript'

defineAndRegister(context, {
  identifier: createVariable('EMPTY_VALUES'),
  value: '{ ... }',                                  // raw string is fine
  destinationPath: this.settings.exportPath
})
```

**Trade-off**: bypasses cross-generator coordination — other
generators can't reach this definition via `insertOperation` /
`insertModel` (there is no Projection class to hand them). Use only
for definitions that don't need cross-generator discoverability; if a
peer might reference it by name, make it a Projection.

## Common questions

### Is a definition really a Snippet?

By inheritance, yes — `DefinitionBase extends SnippetBase` (which
provides `context` and the attribution surface). By role, no — it's
the bridging wrapper for Projections, addressed by file position
rather than embedded in templates.

### Can I update a definition after registering it?

No — definitions are append-only into the file map; first-write-wins
(`addDefinition` ignores a duplicate name). Vary content via
enrichments or the Projection's inputs, not by mutating a
registered definition. (One sanctioned exception: the accumulator
pattern mutates the *value* of a single shared definition — see
gen-msw and the `skmtc-generator` skill's accumulator card.)

### What happens if `value` has no `toString()`?

You'd get `[object Object]` in the output — a clear bug signal. In
practice values are Projection instances (whose `toString()` contract
comes from `SnippetBase`) or strings.

## See also

- [API: Identifier](dsl-identifier.md) — `identifier`, `kind`, `typeName`
- [API: GenerateContext](generate-context.md) — `register({ definitions })`
- [API: SnippetBase](dsl-snippet-base.md) — what DefinitionBase extends
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md)
- [Glossary: Definition](../glossary.md)
