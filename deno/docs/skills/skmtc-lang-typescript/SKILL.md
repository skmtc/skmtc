---
name: skmtc-lang-typescript
version: 0.1.0
description: |
  The TypeScript target-language layer for SKMTC generators
  (`@skmtc/lang-typescript`). Covers how a generator declares
  TypeScript as its target language (importing the projection-base
  veneers and `TsSnippet` from the lang package), what the lang package
  exports (the `typescript` Lang object, the register family,
  `TsFile` / `TsImport` / `TsDefinition` / `TsObject`), entity
  kinds and `Identifier` factories, the import model of emitted
  TypeScript (type-only imports, TS1484 / `verbatimModuleSyntax`,
  `toImport()`), the TS syntax helpers (`List`, `FunctionParameter`,
  `toPathTemplate`, …), and naming/sanitization of emitted identifiers.

  Use this skill alongside `skmtc-generator` whenever a generator emits
  TypeScript — i.e. for almost all generator authoring today — and
  specifically when the user asks about "lang-typescript", "TsSnippet",
  "type-only imports", "TS1484", "import type", "where do I import List
  from", "sanitizePropertyName", or anything about the *shape of the
  emitted TypeScript* rather than engine behavior. Engine rules
  (Projections, Snippets, cross-generator coordination, variants) live
  in `skmtc-generator`. This skill is also the TEMPLATE for future
  `skmtc-lang-<X>` skills (Kotlin, C#, …): a new language skill keeps
  these section headings and replaces the answers.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Write
  - Edit
---

# SKMTC TypeScript language layer

This skill covers the **target-language** side of generator authoring:
what the emitted TypeScript looks like and which package owns each
piece. The boundary rule, worth internalizing first:

> **The authoring language is always TypeScript/Deno; only the target
> language varies.** Rules about how generator *source* is written
> (`as` casts, `switch`+`never`, `Deno.env`, Valibot enrichments) live
> in `skmtc-generator`. This skill covers how the generator's *output*
> is shaped — files, imports, definitions, identifiers, naming — for
> generators whose target is TypeScript.

> **Template contract.** This is the first `skmtc-lang-<X>` skill and
> the template for the rest. A new language skill (Kotlin, C#, …) keeps
> the seven section headings below and replaces the answers. Every
> section now describes symbols owned by THIS package — the naming
> layer and syntax helpers moved out of `@skmtc/core` under F5/F6
> (`notes/lang/17-naming-layer-and-helpers-move.md`); a new language
> ships its own equivalents of §2/§4/§5.

## 1. Package surface

`@skmtc/lang-typescript` exports:

| Export | What it is |
|---|---|
| `typescript` | The `Lang` object. Three neutral factories the engine's **Drivers** call, reading it ephemerally off the projection class's inherited static (`projection.lang`): `createFile`, `toDefinition`, `toImport`. Generators never call it. |
| `TsSnippet` | The snippet base — where TypeScript enters the DSL class hierarchy. Carries the static `lang`; its `register` / `defineAndRegister` methods are typed by the concise vocabulary. Registering snippets are **keyless** (`generatorKey` is optional attribution input) |
| `toModelProjectionBase` / `toOasOperationProjectionBase` / `toGqlOperationProjectionBase` | The projection-base veneers over core's factories — pre-bind `base: TsSnippet` and add own-file `register(args)` + explicit cross-file `registerInto(destinationPath, args)` (+ `Ts*ProjectionBaseConfig` types) |
| `register` / `defineAndRegister` | The register **functions** — convert the concise form, ensure the destination file, hand pure data to the neutral `context.register`. Transforms (closures with no class) import `defineAndRegister` directly |
| `TsRegisterArgs` / `TsDefineAndRegisterArgs` | The concise register vocabulary (`imports` / `reExports` / `definitions`) |
| `TsFile` | `CodeFileBase` subclass — a TypeScript output file (imports, re-exports, definitions, package-aware module normalization) |
| `TsImport` | `ImportBase` subclass — renders import statements, including per-name `type` tags and statement-level `import type { … }` optimization |
| `TsReExport` | `ReExportBase` subclass — renders `export { x }` / `export type { x }` re-export statements (the barrel seam) |
| `TsDefinition` | `DefinitionBase` subclass — wraps a generated value as `export const/type Name: Type = value;` with optional JSDoc |
| `TsObject` | Renders TypeScript object type literals (`{ a: T; b?: U }`) from `TsPropertyArgs[]` |
| `ImportNameArg` | The concise import-name shape (`'name'`, `{ name, type: 'type' }`, `{ name, alias }`) accepted by `register({ imports })` |
| `createVariable` / `createType` | The identifier factories (formerly `Identifier.createVariable` / `.createType` statics on core) — build neutral `Identifier`s with this language's `kind` vocabulary |
| `TsEntityKind` / `toTsKeyword` | The two-kind vocabulary (`'variable' \| 'type'`) and its declaration-keyword mapping (`const` / `type`) |
| `List` / `NextList` / `FunctionParameter` / `PathParams` / `toPathParams` / `toPathTemplate` / `handleKey` / `handlePropertyName` / `keyValues` / `withDescription` | The TypeScript syntax helpers (§4) — moved from core under F5 |
| `sanitizePropertyName` | TS/JS-specific property-name sanitization (§5) — moved from core under F6 |
| `normalizeModuleName` | Module-specifier normalization helper |
| `ReactRouterPathParams` | A stock snippet (`TsSnippet` subclass) for React-Router param plumbing |
| `langId` | `'typescript'` |
| `fileExtensions` | `['.ts', '.tsx']` |

### Wiring — the import graph declares the language

```ts
// gen-x/src/base.ts — the language enters HERE, through the import
import { toModelProjectionBase } from '@skmtc/lang-typescript'

export const MyBase = toModelProjectionBase({
  id: denoJson.name,
  toIdentifier({ refName }) { /* … */ },
  toExportPath({ refName }) { /* … */ }
})
```

```ts
// gen-x/src/mod.ts — the entry is pure pipeline config; NO lang field
import { toModelEntry } from '@skmtc/core'
import denoJson from '../deno.json' with { type: 'json' }

export const myEntry = toModelEntry({
  id: denoJson.name,
  transform({ context, refName }) { /* … */ }
})
```

There is no `lang` config field anywhere — not on the entry, not on
the projection base, not on snippets; `register` calls never pass one.
A generator declares its language by importing its projection-base
factory (and, for registering snippets, `TsSnippet`) from this
package. The language rides the class hierarchy as the static `lang`
on `TsSnippet`; the engine's Drivers read it ephemerally off the
projection class (`projection.lang`) when they need to create a file
or build a Definition.

Generators normally never construct `TsFile` / `TsDefinition` /
`TsImport` directly — this package's register functions and the
engine's Drivers build them. If you find yourself `new TsImport(...)`
in a generator, you almost certainly wanted
`this.register({ imports })`.

The package dependency (both required):

```jsonc
// gen-x/deno.json#imports
{
  "@skmtc/core": "jsr:@skmtc/core@<pin>",
  "@skmtc/lang-typescript": "jsr:@skmtc/lang-typescript@<pin>"
}
```

## 2. Entity kinds & identifiers

TypeScript output has two entity kinds (`TsEntityKind`), created via
the identifier factory functions exported by THIS package:

```ts
import { createVariable, createType } from '@skmtc/lang-typescript'

createVariable('fooBar')                      // → export const fooBar = …
createVariable('fooBar', { typeName: 'Foo' }) // → export const fooBar: Foo = …
createType('FooBar')                          // → export type FooBar = …
```

- Core's `Identifier` is pure neutral data (`name`, opaque `kind`,
  `exported`, opaque `typeName`); the factories write this language's
  `kind` vocabulary (`'variable'` / `'type'`) into it. The old
  `Identifier.createVariable` / `.createType` statics on core are
  gone.
- The kind drives both the **declaration keyword** (`toTsKeyword`:
  `'variable'` → `const`, `'type'` → `type`, rendered by
  `TsDefinition`) and the **import form** (value vs type import,
  see §3).
- **The typed-const annotation (`: Foo`) comes from the Identifier's
  `typeName`, not from the value.** A Projection/Snippet `toString()`
  returns only the right-hand-side expression; `TsDefinition` wraps it
  with `export`, the keyword, the name, and the annotation. Never bake
  `: Foo` or `export const` into the value itself.
- Languages with richer declaration vocabularies (`interface`, `enum`,
  C# `record`, Kotlin `data class`, Rust `struct`) define their own
  kind sets in their own factories; `toTsKeyword` throws on a kind
  outside this language's vocabulary.

## 3. The import model of emitted TypeScript

Generators register imports in the concise form (`ImportNameArg`,
exported from this package — not from `@skmtc/core`); the language's
register function converts them to `TsImport`s at the register
boundary:

```ts
this.register({
  imports: {
    'react-hook-form': [
      'useForm',                              // value import
      { name: 'UseFormProps', type: 'type' }, // type-only import
      { name: 'useForm', alias: 'rhfUseForm' } // aliased
    ]
  }
})
```

Rendering rules `TsImport` applies (authors never hand-write these):

- Per-name `type` tags render inline (`import { useForm, type
  UseFormProps } from …`); when *every* name is a type, the statement
  collapses to `import type { … } from …`.
- Module specifiers: `@/…` paths resolve against the consumer's
  bundler alias (rooted at `client.json#settings.basePath`, or
  per-package when `packages` is configured — cross-package imports
  render the target's `moduleName`). Bare specifiers (`zod`,
  `react-hook-form`) pass through for the consumer's package manager.

### Type-only imports — the TS1484 trap

```ts
// ❌ WRONG — bare value import of a type-only symbol
this.register({
  imports: { 'react-hook-form': ['useForm', 'UseFormProps'] }
})

// ✅ RIGHT — tag the type explicitly
this.register({
  imports: {
    'react-hook-form': ['useForm', { name: 'UseFormProps', type: 'type' }]
  }
})

// ✅ ALSO RIGHT — derive the tag from an Identifier you hold
this.register({
  imports: { './types': [
    identifier.kind === 'type'
      ? { name: identifier.name, type: 'type' }
      : identifier.name
  ] }
})
```

**Fails because:** consumers compiling with `verbatimModuleSyntax:
true` (modern Vite, Next.js strict) reject bare value imports of types
with TS1484. (For peer Definitions inserted via
`insertOperation` / `insertModel`, the Driver already registers the
import with the right form — `TsImport.fromIdentifier` reads the
identifier's `kind`; you only hand-tag imports you register yourself.)
Note this is a **target-language** failure: the generator compiles
fine; the *consumer's* build breaks.

## 4. Syntax helpers

String-building helpers for TypeScript syntax. They all return
`Stringable`-compatible values that compose in template literals:

| Helper | Renders |
|---|---|
| `List` | Delimited lists — arrays, object bodies, arg lists (`List.toArray`, `List.toObject`, `List.toKeyValue`, …) |
| `FunctionParameter` | A typed function parameter, optionally destructured |
| `PathParams` / `toPathParams` | Path-parameter names/types extracted from an OAS path |
| `toPathTemplate` | An OAS path as a TS template literal (`` `/users/${id}` ``) |
| `keyValues` | An object literal from a record, skipping `undefined` values |
| `withDescription` | Prefixes a value with a JSDoc comment block |

All import from `@skmtc/lang-typescript` (moved from core under F5).
A future `lang-<X>` package ships its own equivalents; do not reach
for these when targeting another language.

## 5. Naming & sanitization

- **`sanitizePropertyName(name)`** — makes an arbitrary OAS property
  name safe as a TypeScript object key. JS-specific end to end: babel
  identifier validation, the JS reserved-word list, quoting/camelCase
  fallback via `List.toKeyValue`. Use it whenever emitting object keys
  derived from schema property names.
- **File extensions**: `.ts`, or `.tsx` when the output contains JSX.
  Keep the `.generated.` infix from the engine-side conventions
  (`Foo.generated.tsx`) — that part is language-neutral.
- Identifier validity for *generated names* is normally guaranteed by
  deriving them through `camelCase` / `capitalize` from method+path or
  refName (see `skmtc-generator` §6A); sanitization is for *schema-
  supplied* keys you don't control.

## 6. TypeScript-output anti-patterns

- **Bare value imports of type-only symbols** — §3 above (TS1484).
- **Baking the declaration into the value** — `toString()` returning
  `export const Foo = …` or `: Foo` annotations. The Driver +
  `TsDefinition` add `export`, the keyword, the name, and the
  `typeName` annotation; doubling them is a syntax error
  (`export const Foo = export const Foo = …`). Return only the RHS.
- **Hand-rendering import statements in template literals** — they
  land in the file *body* (TS rejects) and bypass `TsImport`'s dedup
  and `import type` collapsing. Engine-side rule (`skmtc-generator`
  §8) — listed here because the failure is a TS compile error.
- **Constructing `TsFile` / `TsImport` / `TsDefinition` in a
  generator** — those are built by this package's register functions
  and the engine's Drivers. Generators speak `register` /
  `insertOperation` / `defineAndRegister`.
- **Running a formatter over the output** — render is unformatted by
  design; the consumer formats. (Engine fact; restated because "add
  Prettier" is a TS-flavored instinct.)

## 7. Boundary with other skills

- **`skmtc-generator`** — everything engine-side: Projections,
  Snippets, `register` / `registerInto` semantics, cross-generator
  coordination, variants, enrichments, entry factories. If the
  question is "how do generators work", it's there; if it's "what does
  the emitted TypeScript look like", it's here.
- **`skmtc-cli`** — install/clone/bundle/generate commands.
- **`skmtc-debug`** — broken output, verify-first stance.

### Status note

The naming layer and syntax helpers landed in this package under
F5/F6 (core ≥0.9.0 / lang-typescript ≥0.2.0 — see
`notes/lang/17-naming-layer-and-helpers-move.md`): the identifier
factories, `TsEntityKind`, `sanitizePropertyName`, and the §4 helpers
all import from `@skmtc/lang-typescript`. Core's `Identifier` is
neutral data with a public constructor; core's `EntityType`, its
concrete `Definition`, and `Identifier.toImport` no longer exist.
The code boundary now matches the design.
