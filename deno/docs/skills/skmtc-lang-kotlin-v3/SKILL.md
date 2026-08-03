---
name: skmtc-lang-kotlin-v3
version: 0.2.2
description: >
  The Kotlin target-language layer for SKMTC generators
  (@skmtc/lang-kotlin): base factories, KtSnippet, the seven identifier
  kinds, packages-from-paths imports, the head+value render model,
  KtAnnotation and the composition classes, sanitization and
  @SerialName placement, plus the current-API worked example (the
  shipped gen-kotlin-* packages are API-stale — do not copy their call
  shapes). Use ALONGSIDE skmtc-generator-v3 whenever a generator emits
  Kotlin. Headings mirror skmtc-lang-typescript-v3.
---

# The Kotlin layer (@skmtc/lang-kotlin)

Read `skmtc-generator-v3` first.

> **Drift warning.** The API of record is the workspace
> `skmtc/deno/lang-kotlin` and its tests. The shipped `gen-kotlin-*`
> generators predate the 0.9.11 flattening: they call
> `new KtAnnotation('Name', [args])` positionally and import
> `isKtAnnotated`/`isKtSupertyped` (no longer exported; supertype
> clauses now render inline in the value). Clone their **structure**
> only; take call shapes from THIS skill's example (§8), which is pinned
> byte-for-byte against the engine by
> `lang-kotlin/src/skill-v3-example.test.ts`.

## 1. Declaring the language

Same pattern as TypeScript — the import graph declares it. Two
factories: `toKtModelProjectionBase`, `toKtOasOperationProjectionBase`;
snippets extend `KtSnippet`.

```ts
export const KtModelBase = toKtModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  toIdentifierName({ refName, enrichments }) {
    return enrichments?.subject?.name ?? capitalize(camelCase(refName))
  },
  // Kotlin's identifier KIND depends on schema shape → may read context
  // (runs only on cache-miss; the NAME stays pure):
  toIdentifierType(refName, context) {
    return { type: toShape(context, peekSchema(context, refName)) }
  },
  toExportPath({ refName, enrichments }) {
    const name = enrichments?.subject?.name ?? capitalize(camelCase(refName))
    return join('@', ...enrichments.generator.basePackage.split('.'), `${name}.generated.kt`)
  }
})
```

The export path's directory segments ARE the Kotlin package (§4). Make
`basePackage` a **required generator-scope enrichment** with no default;
validate segments with `isKtIdentifierName` + `ktHardKeywords`. Put the
shape dispatch (object+props → `data-class`; string+enums →
`enum-class`; qualifying discriminated union → `sealed-interface`; else
`typealias`) in ONE deterministic function read by both
`toIdentifierType` and the constructor, so kind and value can't disagree.

## 2. Register shapes — Kotlin differences

Same three shapes as TS (projection own-file / `registerInto` / snippet
with required `destinationPath`), plus `defineAndRegister` (no cache
check; no `noExport` — visibility is the identifier's fact: pass
`exported: false` to the factory). Compile-time differences: **no
`reExports` field** (Kotlin has none) and **no `type` tag on imports**
(no type-only imports). `custom` renders above the `package` directive.

## 3. Identifier kinds

Seven: `class`, `data-class`, `enum-class`, `interface`,
`sealed-interface`, `typealias`, `val` — factories `createClass`,
`createDataClass`, `createEnumClass`, `createInterface`,
`createSealedInterface`, `createTypeAlias`, `createValue` (only
`createValue` takes `typeName`; `exported: false` renders `private `).
Deferred kinds (`object`, `fun`, `var`) make `toKtEntityType` throw —
deliberately loud. Kind does NOT affect import form.

## 4. Emitted-import rules

- **Packages from paths**: `@/com/example/api/User.generated.kt` →
  `package com.example.api`. Segments are validated, never sanitized —
  a keyword or invalid segment **throws** (fix the path policy).
- One `import pkg.Name` per symbol (no brace grouping), `as` aliases,
  rendered **sorted** (determinism, not style).
- **Same-package suppression is central**: register imports
  unconditionally; `KtFile` drops same-package ones at render.
- Importing from the default package throws (root-level artifact
  referenced from a packaged one = path-policy bug).

## 5. Render model: head + value

Assignment kinds (`typealias`, `val`): `<head> = <value>`. Declaration
kinds: `<head><value>` — the value renders everything after the name:
parameter list (parens included), inline ` : Parent` clauses, ` { … }`
bodies; an empty value yields the bodyless idiom
(`sealed interface Animal`).

Two things ride on value-carried protocols (the neutral Lang signature
has no slot for them): `KtAnnotated` (`annotations: KtAnnotation[]`,
strict — string look-alikes are silently dropped) and `KtDocumented`
(`description`). **The mirroring gotcha**: the Driver wraps the
PROJECTION as the definition's value, so mirror both onto the projection
— canon is **reference assignment in the constructor**
(`this.annotations = this.value.annotations` — one array, two names;
never copy) — or class-level annotations and KDoc silently vanish.

## 6. Composition classes (current API)

- `KtParameterList(parameters)` — parens included; each
  `{ name, type: Stringable, nullable?, defaultValue?, annotations?,
  visibility? }` renders as an indented `val`, annotations one per line.
- `KtPrimaryConstructor({ parameters, modifiers? })` — modifiers force
  the explicit `constructor` keyword.
- `KtFunctionSignature({ name, parameters, returnType?, annotations?,
  body? })` — abstract by default, expression body only.
- `KtAnnotation({ context, name, args?, packageName?, destinationPath })`
  — a **registering leaf**: with `packageName` it registers its own
  import (register unconditionally; suppression handles same-package).
  `args` are pre-quoted (`['"user_id"']`, `['Foo::class']`).
- `withDescription(value, { description })` — KDoc.

## 7. Sanitization and @SerialName

`sanitizePropertyName(name)`: plain → unchanged; hard keyword or invalid
→ **backticked**; JVM-unescapable characters → **throws** ("rename +
@SerialName"). Renames are NOT its job — serialization annotations
handle wire-name mismatches, and the two compose: decide the annotation
by comparing the *unescaped* chosen name with the wire key
(`` `object` `` needs no @SerialName; `user_id`→`userId` does). Only the
28 hard keywords escape; soft/modifier keywords (`value`, `data`,
`sealed`) are legal identifiers. Canonical pairing:
`sanitizePropertyName(camelCase(key))`.

## 8. Worked example — kotlinx data class (current API, engine-pinned)

Per-property loop inside the data-class value snippet:

```ts
const propertyName = sanitizePropertyName(camelCase(key))
const annotations: KtAnnotation[] = []
if (propertyName.replaceAll('`', '') !== key) {
  annotations.push(new KtAnnotation({
    context, destinationPath,
    name: 'SerialName', packageName: 'kotlinx.serialization', args: [`"${key}"`]
  }))
}
parameters.push({
  name: propertyName,
  type: value,                     // the SNIPPET — never `${value}`
  defaultValue: isRequired ? undefined : 'null',
  annotations
})
// this.parameterList = new KtParameterList(parameters)
// class-level: this.annotations = [new KtAnnotation({ context,
//   destinationPath, name: 'Serializable', packageName: 'kotlinx.serialization' })]
// projection mirrors by REFERENCE: this.annotations = this.value.annotations
```

Renders (verified byte-for-byte through the engine):

```kotlin
package com.example.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    @SerialName("user_id")
    val userId: String,
    val name: String,
    val email: String? = null
)
```

The type expression is the **single owner** of `?`; the parameter layer
only adds `= null`. Passing `` `${value}` `` instead of the snippet
strands its registered imports and synthesized siblings — the file
breaks far from the cause. Serialization flavor is confined to the value
files (data class / enum entries / sealed interface): a Jackson/Moshi
sibling generator swaps annotation construction there only.

## 8b. Normalized models — KNOWN ENGINE GAP (verified 2026-08-03)

The head+value model means a Kotlin value renders differently in TYPE
position (`Map<String, Any?>`) and DECLARATION position (a parameter
list). Core's generic `insertNormalizedModel` glues the identifier
head to the value's type-position `toString()` — which for an inline
OBJECT schema renders invalid Kotlin: `data class XMap<String, Any?>`.
Until a declaration-form protocol exists, the legitimate options are:

- **Named `$ref` schemas are unaffected** — `insertModel` and the ref
  path work correctly; prefer specs/contracts that name their models.
- An inline NON-object schema normalizes fine as a `typealias`-shaped
  value.
- For an inline object: use a normalized-model API the peer package
  explicitly exports, if it has one; otherwise degrade (accept the
  type-position form where semantics allow) and NAME THE GAP in your
  summary. Never fabricate a refName or drive the peer's identity
  statics to force a declaration into existence — that is the
  two-doors rule (skmtc-generator-v3 §4), and the result couples you
  to the peer's private snippet shape.

## 9. Kotlin pitfalls

| Symptom | Fix |
|---|---|
| `@Serializable`/KDoc missing | Mirror `annotations`/`description` getters on the projection |
| Annotation silently dropped | Real `KtAnnotation` instances, not strings |
| `segment 'x' is not a valid package name part` | Fix the export-path policy — packages validate, never sanitize |
| Import mid-file / duplicated | `register` / annotation `packageName`, never templates |
| `String??` | Type expression owns the single `?` |
| `Unknown Kotlin entity type` | Use the seven Kotlin factories, not TS kinds |
| Empty `data class` throws | Shape dispatch must route empty objects to `typealias` |
| TDZ crash at module load | Break base↔router↔projection cycles with a leaf module (`peekSchema` pattern) |
| Nondeterministic output | No module state; config via enrichments; memoize document scans in `WeakMap` |
| `data class X` glued to `Map<String, Any?>` | The normalized-insert type/declaration gap — §8b, don't hack around it |
