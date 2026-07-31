---
name: skmtc-lang-typescript-v3
version: 0.2.1
description: >
  The TypeScript target-language layer for SKMTC generators
  (@skmtc/lang-typescript): projection base factories, TsSnippet, the
  three register shapes, identifier kinds and the type-only import
  machinery, composition helpers, sanitization, TsFile render rules.
  Use ALONGSIDE skmtc-generator-v3 whenever a generator emits
  TypeScript. Headings are the template for other skmtc-lang-*-v3
  skills.
---

# The TypeScript layer (@skmtc/lang-typescript)

Read `skmtc-generator-v3` first; you will normally have cloned
`@skmtc/gen-zod` (model) or `@skmtc/gen-tanstack-query-fetch-zod`
(operation) — **those are the worked examples**. This skill carries the
rules that aren't visible from imitation alone.

## 1. Declaring the language

The declaration is the import graph — no `lang` config field exists.
`src/base.ts` imports a factory; the returned class extends `TsSnippet`,
which carries the `static lang` Drivers read pre-construction.

```ts
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'

export const MyBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toIdentifierName({ refName }) { return decapitalize(camelCase(refName)) },
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath({ refName, enrichments, variant }) {
    const name = this.toIdentifierName({ refName, enrichments, variant })
    return join('@', 'types', `${name}.generated.ts`)   // '@/' root marker
  },
  toEnrichmentSchema
})
```

Factories: `toTsModelProjectionBase`, `toTsOasOperationProjectionBase`
(+ webhook/GQL variants). Snippets extend `TsSnippet` directly. Casing
helpers (`camelCase`, `capitalize`, `decapitalize`) and `toEndpointName`
come from `@skmtc/core`; `join` from `@std/path`.

A projection consumable by peers via `insertNormalizedModel` also needs
two statics: `schemaToValueFn` (your router) and `createIdentifier`.

## 2. The three register shapes

| Caller | Call | Destination |
|---|---|---|
| Projection | `this.register(args)` | its own export file |
| Projection | `this.registerInto(path, args)` | explicit file |
| Snippet | `this.register({ ...args, destinationPath })` | required — snippets own no file |

Free functions for transform-level code: `register(context, args)`;
`defineAndRegister(context, { identifier, value, destinationPath })` —
no cache check (pair with `context.findDefinition` for the accumulator
get-or-create idiom). Args:
`{ imports?: Record<module, ImportNameArg[]>, reExports?, definitions?,
custom? }`. `register` creates the file on first write and drops
self-imports, so register imports unconditionally — per-leaf
registration (every snippet needing `z` registers `{ zod: ['z'] }`) is
the correct pattern, and merging is idempotent.

## 3. Identifier kinds

`TsEntityType = 'variable' | 'type' | 'class' | 'interface' |
'namespace'` — factories `createVariable(name, { typeName? })`,
`createType`, `createClass`, `createInterface`, `createNamespace`.
No `'function'` kind: a generated function is a `variable` whose value
renders as an arrow function.

`toIdentifierType` is one lever with three effects: declaration keyword;
block form (class/interface/namespace take no `= value;`); and whether
consumers import it **type-only** (`type` and `interface` do — this is
what keeps consumers compiling under `verbatimModuleSyntax`/TS1484, and
you get it by choosing the kind, never by writing import syntax).
File dedup keys on keyword+name, so `class Foo` + `namespace Foo`
coexist (declaration merging); first write wins per slot.

## 4. Emitted-import rules

Concise forms per module: `['z']` (named), `[{ default: 'invariant' }]`
(aliased/default), `[{ name: 'User', type: 'type' }]` (type-only).
Sharp edge: only `type: 'type'` triggers type-only in the concise form —
`type: 'interface'` does NOT; tag interfaces `type: 'type'`. Register
against `@/…` export paths; module names are re-keyed at render via the
project's package settings.

## 5. Composition helpers

All `Stringable`, all deferring joins to render — use them instead of
`array.join` whenever items are snippets (joining pre-renders and orphans
provenance):

- `List` — `List.toObject/toArray/toParams/toLines/toKeyValue`,
  `List.fromKeys(record).toObject(fn)`, `new List(values, { separator,
  bookends, skipEmpty })`.
- `FunctionParameter({ typeDefinition, destructure, required, skipEmpty })`
  — one object, four readings: `toString()` (declaration), `toInbound()`
  (call site), `toPropertyList()`, `hasProperty(name)`.
- `toPathTemplate('/users/{id}')` → `` /users/${id} ``; `toPathParams` →
  `/users/:id`; `PathParams` bundles type + parameter + template.
- `keyValues`, `withDescription`, `handleKey`, `handlePropertyName`;
  `TsClass`/`TsHeritage` for class syntax (`TsHeritage` registers its own
  heritage imports).

## 6. Sanitizing emitted names

Two different questions: `sanitizeIdentifier(name)` for **binding
names** (`export const <name>`; repairs `'2fa'` → `'_2fa'`, reserved →
suffixed) vs `sanitizePropertyName(name)` for **property keys /
destructuring** (returns a rename pair when repair is needed). Never
hand-roll keyword lists.

## 7. Files

Render order: custom banner → re-exports → imports → definitions;
first-wins per definition slot makes output order-independent. You
almost never construct `TsFile`/`TsImport`/`TsDefinition` yourself —
`register` and the Drivers do.

## 8. The contrast that matters

```ts
// WRONG: stored rendered text — z import never registers, refs duplicate
this.properties[key] = `z.string().optional()`
// RIGHT: stored snippet — imports settle, cache sees it, provenance holds
this.properties[key] = toMyValue({ schema: propSchema, required, destinationPath, context })
```

A cached peer *name* is a legitimate string — minding the two insert
return shapes: `this.responseName = definition.identifier.name` from
`insertNormalizedModel`, or `.toName()` off `insertModel`'s `Inserted`
handle. Modifier pipelines (`applyModifiers`-style) run inside
`toString()`, never to build stored fields.

## 9. TypeScript pitfalls

| Symptom | Fix |
|---|---|
| TS1484 in consumers | Identifier kind `type`/`interface`; concise imports need `type: 'type'` |
| Interface import emitted as value | Tag it `type: 'type'` (known concise-form gap) |
| TS7022/7024 on recursive schemas | Set `settings.identifier.typeName` (e.g. `z.ZodType<X>`) post-construction; the *name* stays stable |
| Provenance holes under some nodes | `toString` must be a prototype method, never an arrow field |
| Doubled `?`/modifiers | One owner: apply modifiers once, at the leaf's render |
