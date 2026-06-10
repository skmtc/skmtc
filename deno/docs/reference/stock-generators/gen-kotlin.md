# @skmtc/gen-kotlin

> Produce Kotlin DTOs (`kotlinx.serialization` data classes) from
> OpenAPI schemas.

A model generator — the Kotlin analog of `gen-typescript`, and the
proving generator for the `@skmtc/lang-kotlin` language layer (the
first non-TypeScript generator on the language-blind engine).

## Source

`skmtc-generators/gen-kotlin/src/`

## What it generates

For a `User` schema (`user_id`/`name` required, `email` optional):

```kotlin
package com.example.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    @SerialName("user_id") val userId: String,
    val name: String,
    val email: String? = null
)
```

Shape routing (one projection class per Kotlin declaration kind,
dispatched by `toKtProjection` — shared by the transform and `KtRef`):

| Schema shape | Declaration |
|---|---|
| object with properties | `@Serializable data class` |
| string with enums | `@Serializable enum class` — CONSTANT_CASE entries, `@SerialName` wire values |
| everything else | `typealias` (arrays → `List<T>`, additionalProperties-objects → `Map<String, T>`, empty objects → `JsonObject`, `oneOf` → `JsonElement` v1 fallback) |

Inline (nested) objects and string enums synthesize **named siblings**
in the same file (Kotlin has no anonymous shapes): `User.address` →
`data class UserAddress`.

## Entry — a factory, no default export

`basePackage` is required and has no default:

```ts
import { toKotlinEntry } from '@skmtc/gen-kotlin'

export default toKotlinEntry({
  basePackage: 'com.example.api',
  scalars: { 'date-time': 'String' }   // optional format overrides
})
```

`client.json#settings.basePath` points at the Gradle source root
(`./app/src/main/kotlin`); export paths encode the package
(`@/com/example/api/User.generated.kt`), so files land on Kotlin's
package-=-folder convention and `KtFile` derives each `package`
directive from its path.

## Conventions

- camelCase properties; `@SerialName` whenever the property name
  differs from the wire name (Kotlin cannot quote property names — the
  annotation IS the rename mechanism). Hard keywords backtick-escape
  (`` val `object`: String ``) and need no annotation.
- Optional → `T? = null`; nullable-but-required → `T?` (no default).
- `integer`/`int64` → `Long`, `number`/`float` → `Float`; string
  formats map through the scalar map (`binary` → `ByteArray`, the rest
  → `String` by default).
- Same-package peer imports are suppressed (all models share
  `basePackage` in v1, so cross-model references render bare).

## Customization seams (clone to change)

| Seam | Location |
|---|---|
| Serialization flavor (`@Serializable`/`@SerialName` → Jackson/Moshi) | `src/KtDataClassValue.ts` + `src/KtEnumEntries.ts` — the only files that name kotlinx |
| Identifier naming / export layout | `src/base.ts` |
| Shape dispatch | `src/toKtProjection.ts` |
| Scalar/type mapping | `src/scalars.ts`, `src/KtPrimitives.ts` |

## v1 limits (documented, deliberate)

- `oneOf` → `typealias Name = JsonElement`; the sealed-interface
  treatment (inverse-membership scan, `@JsonClassDiscriminator` wiring,
  degenerate unions) is the named follow-up.
- Objects with BOTH `properties` and `additionalProperties` keep the
  properties; the additional channel is dropped.
- Integer enums are not modeled; `insertNormalizedModel` against the
  data-class/enum-class projections throws (insert by refName).
- A synthesized nested-class name can collide with a real schema of the
  same name in the same package — rename one side.

Architecture: `notes/lang/19-kotlin-architecture.md`. Language layer
skill: `docs/skills/skmtc-lang-kotlin/`.
