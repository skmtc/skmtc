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
| qualifying discriminated `oneOf` | `sealed interface` + member wiring (below) |
| everything else | `typealias` (arrays → `List<T>`, additionalProperties-objects → `Map<String, T>`, empty objects → `JsonObject`, non-qualifying `oneOf` → `JsonElement`) |

Inline (nested) objects and string enums synthesize **named siblings**
in the same file (Kotlin has no anonymous shapes): `User.address` →
`data class UserAddress`.

## Sealed `oneOf` mapping

A union **qualifies** for a sealed interface iff it has a
`discriminator`, at least two members, every member is a `$ref`, and
every member's target is an object-with-properties. Everything else
keeps the `JsonElement` fallback. For a qualifying
`Animal: oneOf [Dog, Cat]` with
`discriminator { propertyName: petType, mapping: { dog: …, cat: … } }`:

```kotlin
@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("petType")
sealed interface Animal
```

and each member data class gains three things:

```kotlin
@Serializable
@SerialName("dog")                      // the wire tag: the mapping key,
data class Dog(                         // else the member's schema name
    val name: String,
    val barkVolume: Long? = null
) : Animal                              // the supertype clause
```

- **The discriminator property is OMITTED from member classes** —
  kotlinx forbids a serialized property colliding with the class
  discriminator; the polymorphic envelope carries it (round-trip
  verified). This is the one deliberate divergence from the schema's
  property list.
- A member claimed by several qualifying unions implements all of them
  (` : Animal, Pet`) — but every parent must derive the SAME wire tag;
  conflicting tags fail the member loudly (one `@SerialName` per
  class).
- **Filter footgun:** membership derives from the document, not the
  post-`skip`/`include` set (dependency edges are filter-blind).
  Skipping a qualifying parent while generating its members leaves a
  dangling `: Animal` that fails the consumer compile.
- Closed polymorphism is automatic — consumers need no
  `SerializersModule`; `Json.decodeFromString<Animal>(...)` dispatches
  on the discriminator.

## Union hints (enrichments)

A consumer can assert what the schema author omitted — a discriminator
(and, for inline unions, a name) — and the union flows through the
sealed machinery above (`settings.enrichments["@skmtc/gen-kotlin"]`):

```jsonc
// top-level union refName:
"Animal": { "main": { "discriminator": { "propertyName": "petType" } } }
// inline union, one level of properties.<prop>:
"ListPrice": { "main": { "properties": { "structure": {
  "name": "PricingStructure",
  "discriminator": { "propertyName": "pricingType" }
} } } }
```

Hinted wire tags derive from each member's discriminator property when
it resolves to a single-valued string enum (`GRADUATED`), else the
member refName. Hints are VALIDATED: every member must be a `$ref` to
an object carrying the asserted property; a bogus hint fails its item
loudly (manifest error), never a silent `JsonElement` fallback. Two
hint sites may share one synthesized parent name (claims dedup).
Deeper-than-one-level paths are a named exclusion.

## Entry — a factory, no default export

`basePackage` is required and has no default:

```ts
import { toKotlinEntry } from '@skmtc/gen-kotlin'

export default toKotlinEntry({
  basePackage: 'com.example.api',
  scalars: { 'date-time': 'kotlinx.datetime.Instant' }   // optional format overrides
})
```

A DOTTED scalar value renders its simple name and registers the
import; kotlinx-datetime types are natively `@Serializable`, so no
serializer wiring is needed — the consumer adds the
`kotlinx-datetime` dependency. Model renames and KDoc: the
`[refName].main.name` enrichment aliases the identifier, the FILE,
every ref site, and supertype clauses; schema `description`s render
as class-level KDoc.

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
| Serialization flavor (`@Serializable`/`@SerialName`/`@JsonClassDiscriminator` → Jackson/Moshi) | `src/KtDataClassValue.ts` + `src/KtEnumEntries.ts` + `src/KtSealedInterfaceValue.ts` — the only files that name kotlinx |
| Identifier naming / export layout | `src/base.ts` |
| Shape dispatch + sealed qualifying predicate | `src/toKtProjection.ts`, `src/sealedMembership.ts` |
| Scalar/type mapping | `src/scalars.ts`, `src/KtPrimitives.ts` |

## Limits (documented, deliberate)

- Non-qualifying `oneOf` → `typealias Name = JsonElement`:
  undiscriminated unions, inline members (no refName to invert),
  primitive members, and INLINE unions of any shape (an inline union
  has no refName, so it can never be sealed). Single-member `oneOf`s
  never reach the generator — core's parse collapses `oneOf: [X]`
  into `X` itself (a ref member arrives dereferenced, so the schema
  renders as a structural copy).
- Objects with BOTH `properties` and `additionalProperties` keep the
  properties; the additional channel is dropped.
- Integer enums are not modeled; `insertNormalizedModel` against the
  data-class/enum-class/sealed-interface projections throws (insert by
  refName).
- A synthesized nested-class name can collide with a real schema of the
  same name in the same package — rename one side.

Architecture: `notes/lang/19-kotlin-architecture.md` (Phase D) +
`notes/lang/22-kotlin-sealed-oneof-architecture.md` (sealed `oneOf`).
Language layer skill: `docs/skills/skmtc-lang-kotlin/`.
