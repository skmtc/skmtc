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
> the seven section headings below and replaces the answers. Sections
> marked `[F5]` / `[F6]` document symbols that *currently* live in
> `@skmtc/core` and are scheduled to move into the lang package — see
> `notes/lang/checklist.md`. A new language gets no
> equivalents of those until F5/F6 land.

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

## 2. Entity kinds & identifiers  `[F6 — currently imported from @skmtc/core]`

TypeScript output has two entity kinds, created via `Identifier`
factories:

```ts
import { Identifier } from '@skmtc/core'   // F6: moves to lang-typescript later

Identifier.createVariable('fooBar')                      // → export const fooBar = …
Identifier.createVariable('fooBar', { typeName: 'Foo' }) // → export const fooBar: Foo = …
Identifier.createType('FooBar')                          // → export type FooBar = …
```

- The entity kind drives both the **declaration keyword** (`const` vs
  `type`, rendered by `TsDefinition`) and the **import form** (value
  vs type import, see §3).
- **The typed-const annotation (`: Foo`) comes from the Identifier's
  `typeName`, not from the value.** A Projection/Snippet `toString()`
  returns only the right-hand-side expression; `TsDefinition` wraps it
  with `export`, the keyword, the name, and the annotation. Never bake
  `: Foo` or `export const` into the value itself.
- `kind` is an opaque per-language discriminant (defaults to the
  entity type). Languages with richer declaration vocabularies
  (`interface`, `enum`, C# `record`, Kotlin `data class`) interpret it;
  TypeScript currently uses the two-kind vocabulary above.

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

// ✅ BETTER — when you already hold an Identifier, let it pick the form
this.register({
  imports: { './types': [this.userBody.identifier.toImport()] }
})
```

**Fails because:** consumers compiling with `verbatimModuleSyntax:
true` (modern Vite, Next.js strict) reject bare value imports of types
with TS1484. `identifier.toImport()` threads the entity kind through
automatically — prefer it whenever the symbol came from an
`Identifier` (e.g. a peer Definition's identifier). Note this is a
**target-language** failure: the generator compiles fine; the
*consumer's* build breaks.

## 4. Syntax helpers  `[F5 — currently exported from @skmtc/core]`

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

All currently import from `@skmtc/core` (they predate the lang split —
F5 moves them here). A future `lang-<X>` package ships its own
equivalents; do not reach for these when targeting another language.

## 5. Naming & sanitization  `[F6 — currently imported from @skmtc/core]`

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

### Status note (read before relying on import paths)

The code boundary still lags the design in the naming layer:
`Identifier`, `EntityType`, `sanitizePropertyName`, and the §4 syntax
helpers still live in `@skmtc/core` (F5/F6 in
`notes/lang/checklist.md`). `ImportNameArg` has already moved — it is
exported from `@skmtc/lang-typescript`, not from core. This skill
documents the **current** import paths; when F5/F6 land, the remaining
symbols move to `@skmtc/lang-typescript` and this skill (and every
`lang-<X>` skill cloned from it) must be updated in the same change.
