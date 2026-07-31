---
name: skmtc-lang-typescript-v3
version: 0.1.0
description: >
  The TypeScript target-language layer for SKMTC generators
  (@skmtc/lang-typescript). Covers declaring TypeScript as a generator's
  target (toTsModelProjectionBase / toTsOasOperationProjectionBase,
  TsSnippet), the three register call shapes, identifier entity kinds and
  factories, the emitted-TS import model (type-only imports,
  verbatimModuleSyntax/TS1484), value-composition helpers (List,
  FunctionParameter, toPathTemplate), naming/sanitization, TsFile render
  rules, and a worked example. Use ALONGSIDE skmtc-generator-v3 whenever a
  generator emits TypeScript — that skill carries engine rules; this one
  carries the concrete classes. Section headings are the template for other
  skmtc-lang-*-v3 skills.
---

# The TypeScript layer (@skmtc/lang-typescript)

Read `skmtc-generator-v3` first — this skill assumes its mental model
(three phases, object trees, identity-before-construction, the memoization
cache) and only covers what is TypeScript-specific.

## 1. Declaring the language

A generator declares TypeScript **through its import graph** — there is no
`lang` field in any config. The chain: your `src/base.ts` imports a
projection-base factory from `@skmtc/lang-typescript`; the returned class
extends `TsSnippet`; `TsSnippet` carries `static lang` (the `typescript`
Lang object); the engine's Drivers read `Projection.lang` off the class,
pre-construction.

```ts
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'

export const ZodBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toIdentifierName({ refName }) {
    return decapitalize(camelCase(refName))   // a const gets a value name
  },
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath({ refName, enrichments, variant }) {
    const name = this.toIdentifierName({ refName, enrichments, variant })
    return join('@', 'types', `${name}.generated.ts`)
  },
  toEnrichmentSchema
})
```

The four factories: `toTsModelProjectionBase`,
`toTsOasOperationProjectionBase`, `toTsWebhookProjectionBase`,
`toTsGqlOperationProjectionBase`. Each returns a class with the identity
statics installed plus TypeScript-typed `register` ergonomics. Snippets
extend `TsSnippet` directly.

`camelCase` / `capitalize` / `decapitalize` and `toEndpointName` come from
`@skmtc/core`, not this package. `join` is `@std/path`.

## 2. The three register call shapes

All import/definition writes go through the register vocabulary — never
through emitted text. Three shapes, easy to confuse:

| Caller | Call | Destination |
|---|---|---|
| Projection | `this.register(args)` | its **own** export file (`settings.exportPath`) |
| Projection | `this.registerInto(path, args)` | an explicit file |
| Snippet | `this.register({ ...args, destinationPath })` | `destinationPath` is **required** — a snippet has no file of its own |

Plus two free functions for transform-level code: `register(context, args)`
and `defineAndRegister(context, { identifier, value, destinationPath,
description })` — the latter wraps a value in a `TsDefinition` and registers
it (no cache check — wrap with `context.findDefinition` yourself where
dedup is wanted; that pairing is the accumulator get-or-create idiom).

The args shape (`TsRegisterArgs`):

```ts
{
  imports?: Record<string, ImportNameArg[]>   // by module path
  reExports?: Record<string, TsIdentifier[]>
  definitions?: (DefinitionBase | undefined)[]
  custom?: Stringable                          // file banner slot, last write wins
}
```

`register` creates the destination `TsFile` on first write and silently
drops self-imports (module === destination), so you can register imports
unconditionally without pre-checking. Import registration is idempotent —
per-leaf registration (every snippet that needs `z` registers
`{ zod: ['z'] }` itself) is the correct pattern, not a bug.

## 3. Identifiers: five entity kinds, five factories

```ts
type TsEntityType = 'variable' | 'type' | 'class' | 'interface' | 'namespace'
```

| Factory | Emits | Consumers import it |
|---|---|---|
| `createVariable(name, { typeName?, exported? })` | `export const Name[: Type] = v;` | plain |
| `createType(name)` | `export type Name = v;` | **type-only** |
| `createClass(name)` | `export class Name <v>` | plain |
| `createInterface(name)` | `export interface Name <v>` | **type-only** |
| `createNamespace(name)` | `export declare namespace Name <v>` | plain |

There is **no `'function'` kind** — a generated function is a `'variable'`
whose value renders as an arrow function.

`toIdentifierType` is a single two-word lever with three downstream
effects: the declaration keyword, block-vs-assignment form (class /
interface / namespace take no `= value` and no `;`), and whether every
consumer's import of this definition is type-only.

File-level dedup keys on `declarationKey()` = keyword + name, so different
kinds sharing a name are different slots — that is how TS declaration
merging (`class Foo` + `declare namespace Foo`) is represented; the file
renders primaries first, then same-name companions.

## 4. The emitted-TS import model

The concise author-facing form, per module:

```ts
imports: {
  zod: ['z'],                                     // plain named import
  'tiny-invariant': [{ default: 'invariant' }],   // aliased/default form
  '@/types/user.generated.ts': [{ name: 'User', type: 'type' }] // type-only
}
```

Rules that matter:

- **Type-only is automatic on the Driver path.** When the engine stitches a
  cross-file import for a definition whose identifier kind is `type` or
  `interface`, it emits `import type { … }`. This is what keeps consumers
  compiling under `verbatimModuleSyntax` (TS1484). You get it by choosing
  the identifier kind — not by writing import syntax.
- In the concise form, only the explicit `{ name, type: 'type' }` triggers
  type-only. Known sharp edge: `{ name, type: 'interface' }` does **not** —
  if you need a type-only import of an interface via the concise form, tag
  it `type: 'type'`.
- Imports merge per module; specifiers dedup on their rendered form, so
  `Foo` and `type Foo` stay distinct.
- Module names are re-keyed at **render** time (`@/…` roots to relative
  specifiers or package names via the project's package settings) — register
  against export paths and let the file resolve them.
- When *every* specifier of a module is type-only the file renders the
  statement form `import type { A, B } from '…'`; otherwise per-name tags.

## 5. Value composition helpers

The workhorses, all `Stringable`, all deferring their join to render:

- **`List`** — the universal list builder.
  `new List(values, { separator?, bookends?, skipEmpty? })` filters
  `undefined` on construction. Statics for common shapes:
  `List.toObject([...])` → `{a, b}`, `List.toArray([...])` → `[a, b]`,
  `List.toParams`, `List.toLines`, `List.toKeyValue(k, v)`,
  `List.fromKeys(record).toObject(mapFn)`, `List.toConditional`. Use a
  `List` (not `array.join`) whenever the items are snippets — joining
  pre-renders them and orphans their provenance. (`NextList` is the exported
  successor with `add()`/`prefix`/`suffix`; stock generators still use
  `List` — prefer `List` for consistency until the migration lands.)
- **`FunctionParameter`** — a parameter you can render three ways:
  `new FunctionParameter({ typeDefinition, destructure: true, required:
  true, skipEmpty: true })`. `toString()` → the declaration
  (`{a, b}: Args`), `toInbound()` → the call-site form, `toPropertyList()`
  → a `List` of names, `hasProperty(name)` → structural query. This is the
  canonical example of why objects beat strings: three renderings + a query
  off one stored object.
- **`toPathTemplate(path, argName?)`** — `/users/{id}` → `` /users/${id} ``
  (or `` ${params.id} `` with an argName). `toPathParams(path)` →
  `/users/:id` (React-Router form). `PathParams` bundles a params type
  definition + parameter + templated path.
- **`keyValues(record)`** — `{k: v, …}` dropping empty values;
  `withDescription(value, { description })` — JSDoc block;
  `handleKey(key)` — quote a key only when needed;
  `handlePropertyName(name, parent)` — dot vs bracket access.
- **`TsClass` / `TsProperty` / `TsMethod` / `TsConstructor` / `TsHeritage`**
  — class-syntax builders; `TsHeritage` registers its own superclass/
  interface imports (the one helper that does).

## 6. Naming and sanitization of emitted identifiers

Two different questions, two different functions:

- **`sanitizeIdentifier(name)`** — for **binding names**
  (`export const <name>`). Repairs invalid characters, prefixes `_` when
  needed, suffixes reserved words (`export` → `exportValue`). `'2fa'` →
  `'_2fa'`.
- **`sanitizePropertyName(name)`** — for **property keys / destructuring**.
  `export` is a fine property key but not a binding — this one returns
  either the plain string or a rename pair (`'my key': myKey` as a `List`)
  for destructuring positions.

Use them at the boundary where schema-provided names become emitted
identifiers; never hand-roll keyword lists.

## 7. Files

`TsFile` holds three maps (definitions by `declarationKey()`, imports and
re-exports by module). Render order: **custom banner → re-exports →
imports → definitions**, sections separated by blank lines. First write
wins per definition slot — registration order cannot change output, which
is what makes generation order-independent and byte-stable. You almost
never construct `TsFile`/`TsImport`/`TsDefinition` directly; `register` and
the Drivers do.

## 8. Worked example — a minimal zod-style model generator

The canonical projection (abridged from `@skmtc/gen-zod`):

```ts
export class ZodProjection extends ZodBase {
  value: TypeSystemValue

  constructor({ context, refName, settings, destinationPath, rootRef }: ConstructorArgs) {
    super({ context, refName, settings })
    const schema = context.resolveSchemaRefOnce(refName, ZodBase.id)
    this.value = toZodValue({ schema, required: true, destinationPath, context, rootRef })
  }

  // Make this generator consumable by peers via insertNormalizedModel:
  static schemaToValueFn = (...args: Parameters<typeof toZodValue>) => toZodValue(...args)
  static createIdentifier = createVariable

  override toString() {
    return `${this.value}`   // ONE interpolation; the tree collapses at render
  }
}
```

The router — one exhaustive switch over `schema.type`, **every branch
returning a snippet instance**:

```ts
switch (schema.type) {
  case 'object':
    return new ZodObject({ context, destinationPath, objectSchema: schema,
      modifiers, generatorKey, rootRef })
  case 'string':
    return new ZodString({ ... })   // enums decided inside its toString()
  case 'ref':
    return new ZodRef({ ... })      // drives the Driver: cache hit or recurse
  // ...array, union, number, integer, boolean, void, unknown, custom...
  default: {
    const _exhaustive: never = schema
    throw new Error(...)
  }
}
```

A leaf snippet — imports at construction, syntax only inside `toString()`:

```ts
export class ZodString extends TsSnippet {
  constructor({ context, stringSchema, modifiers, destinationPath, generatorKey }) {
    super({ context, generatorKey, stackTrail: stringSchema.stackTrail.clone() })
    this.enums = stringSchema.enums
    this.modifiers = modifiers
    this.register({ imports: { zod: ['z'] }, destinationPath })  // ← construction
  }
  override toString() {                                          // ← render
    const content = this.enums?.length
      ? `z.enum([${this.enums.map(e => `"${e}"`).join(', ')}])`
      : `z.string()`
    return applyModifiers(content, this.modifiers)   // .nullable().optional()
  }
}
```

### Wrong vs right, with the failure it causes

```ts
// WRONG: stores rendered text; the z import never registers, refs duplicate
this.properties[key] = `z.string().optional()`

// RIGHT: stores the snippet; imports settle, cache sees it, provenance holds
this.properties[key] = toZodValue({ schema: propSchema, required, destinationPath, context })
```

The wrong version renders fine for one model. It fails when any other model
`$ref`s this one (no definition in the cache → duplicate), and the file's
import header is missing `z` unless some *other* leaf happened to register
it — an error that surfaces far from its cause.

Consuming a peer from an operation generator (React-Query consuming zod):

```ts
const zodResponse = this.insertNormalizedModel(ZodProjection, {
  schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
  fallbackName: `${decapitalize(settings.identifier.name)}Response`
})
this.zodResponseName = zodResponse.identifier.name  // a NAME is a legit string leaf
```

## 9. Where plain strings are legitimate

- Identifier names and export paths (the config contract returns `string`).
- Module specifiers and imported symbol names in `register` args.
- Literal target-syntax assembled **inside a `toString()` body** from
  already-structured fields (`` `z.array(${this.items})` ``).
- A cached peer *name* (`this.zodResponseName`) — the peer's definition is
  already an object registered elsewhere; only the reference is textual.
- Render-time string transforms (`applyModifiers`, `toPathTemplate`) called
  from inside `toString()`, never to build a stored field.

Mandatory objects: the projection's `value`, every recursive child, any
accumulating list of snippets, `FunctionParameter`, and anything a peer
must find via the cache.

## 10. TypeScript-specific pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| TS1484 in consumer projects | Type imported as value under `verbatimModuleSyntax` | Set identifier kind `type`/`interface`; concise imports need `type: 'type'` |
| `interface` import emitted as value import | Concise `{ type: 'interface' }` isn't recognized as type-only | Tag it `type: 'type'` |
| TS7022/TS7024 on recursive schemas | Self-referencing const can't infer its type | Set `settings.identifier.typeName` (e.g. `z.ZodType<User>`) when recursion is detected — mutating `typeName` post-construction is sanctioned; the *name* must stay stable |
| Attribution gaps under some nodes | `toString` written as an arrow-function instance field | `toString` must be a prototype method (the base wraps it at construction) |
| Import lands mid-file | Import written in a template | `register` with `imports:` (lint: `no-template-imports`) |
| Doubled `?` or misplaced modifiers | Optional/nullable applied in two layers | One owner: apply modifiers once, at the leaf's render |
