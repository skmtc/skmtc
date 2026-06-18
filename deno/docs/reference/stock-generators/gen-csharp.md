# @skmtc/gen-csharp

C# DTOs from `components.schemas`: nominal `sealed partial record`
types for objects, `enum` for string enums — serialization flavor is
**System.Text.Json attributes with zero consumer dependencies beyond
the BCL**. The third language's proving generator (after
gen-typescript and gen-kotlin), riding `@skmtc/lang-csharp`.

Validated floor: **.NET 10 LTS** (generated code uses no API newer
than .NET 9 — `[JsonStringEnumMemberName]` is the floor-setter).

## Source

`skmtc-generators/gen-csharp` (fleet).

## What it generates

| Schema shape | Declaration |
|---|---|
| object with properties | `public sealed partial record` with `required`/`init` property members |
| string with enums | `public enum` — PascalCase members, `[JsonStringEnumMemberName]` wire values, class-level `[JsonConverter(typeof(JsonStringEnumConverter))]` |
| qualifying discriminated `oneOf` | `public abstract partial record` parent with parent-side `[JsonPolymorphic]`/`[JsonDerivedType]` attributes + member wiring (below) |
| everything else | **NO artifact** (D6: C# has no exported type alias) — ref sites inline the type expression: arrays → `IReadOnlyList<T>`, additionalProperties-objects → `IReadOnlyDictionary<string, T>`, empty objects → `JsonObject`, non-qualifying unions → `JsonElement` |

Property mapping (D4 + A1):

| Schema | Property |
|---|---|
| required, non-nullable | `public required T X { get; init; }` |
| optional | `public T? X { get; init; }` + `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` — null serializes as ABSENT |
| required + nullable | `public required T? X { get; init; }` — null is WRITTEN (`"x": null`) |

`[JsonPropertyName("<wire>")]` is emitted whenever wire ≠ property
name — nearly always, since properties are PascalCased; explicit beats
coupling to the consumer's `PropertyNamingPolicy`. A property whose
name would equal the enclosing type's name (CS0542) takes the
deterministic `<Name>Value` rename; the attribute keeps the wire name.

Mixed objects (`properties` + `additionalProperties`) carry a
`[JsonExtensionData] public IDictionary<string, JsonElement>?
AdditionalProperties { get; init; }` member (D16) — unknown fields
round-trip. Objects WITHOUT declared `additionalProperties` silently
drop unknown request fields (the STJ default; documented limit).

Inline objects and inline string enums synthesize **named types in
their own canonical file** (`@/<ns>/<FallbackName>.generated.cs` —
one type per file, deduplicated globally; a deliberate divergence from
gen-kotlin's same-file siblings, since D6 inlining reached from
several files would otherwise duplicate the type in one namespace).
Name chains extend per property: `User` → `UserAddress` →
`UserAddressItem`.

## Polymorphic `oneOf` mapping (CS-B)

A union qualifies when it is **discriminated, has ≥2 members, every
member is a `$ref`, and every target is an object-with-properties**
(core merges `oneOf`/`anyOf`, so a discriminated `anyOf` qualifies
too). The parent renders bodyless with parent-side attributes —
OpenAPI's own direction, zero custom converters:

```csharp
[JsonPolymorphic(TypeDiscriminatorPropertyName = "petType")]
[JsonDerivedType(typeof(Dog), "dog")]
[JsonDerivedType(typeof(Cat), "cat")]
public abstract partial record Animal;
```

Tags come from `discriminator.mapping` (full-ref and bare-name forms
accepted) else the member's refName. Members carry ` : Animal` and
OMIT the discriminator property (STJ rejects the collision); a member
left empty after omission renders the bodyless
`public sealed partial record X : Animal;`. The parent inserts its
members, so subtypes exist even when nothing else references them.

**Consumer setup:** out-of-order discriminators (`petType` not first
in the payload) throw `NotSupportedException` under default options.
Servers accepting arbitrary client payloads should set
`AllowOutOfOrderMetadataProperties = true` (.NET 9+): minimal APIs via
`builder.Services.ConfigureHttpJsonOptions(o =>
o.SerializerOptions.AllowOutOfOrderMetadataProperties = true)`, MVC
via `.AddControllers().AddJsonOptions(…)`.

**Limit:** a member claimed by MULTIPLE qualifying unions fails its
item loudly — a C# record derives from one base record (Kotlin's
sealed interfaces admit multi-parent membership; abstract records do
not). Restructure the schema. Inline unions can never be polymorphic
(no refName for the membership inversion) — `JsonElement` until CS-D
union hints.

## Scalars (D12 — rich defaults)

`uuid` → `Guid`, `date-time` → `DateTimeOffset`, `date` → `DateOnly`,
`time` → `TimeOnly`, `binary`/`byte` → `byte[]` (base64), `int64` →
`long`, `int32` → `int`, `float` → `float`, default number →
`double`, other known string formats → `string`. All natively
STJ-serializable — zero converters. Override via
`toCsharpEntry({ scalars })`; a dotted value (`Acme.Types.Money`)
renders its simple name and registers the namespace using. Unknown
formats map to `string` and log once per format.

## Entry — a factory, no default export

```ts
import { toCsharpEntry } from '@skmtc/gen-csharp'

export default toCsharpEntry({
  baseNamespace: 'Acme.Api.Models',   // REQUIRED — no default
  scalars: { 'money': 'decimal' }     // optional, merges over defaults
})
```

`baseNamespace` is encoded into every export path
(`@/<baseNamespace dirs>/<Name>.generated.cs`), so with
`client.json#settings.basePath` pointing at the consumer's project
source root, files land on the folder-=-namespace convention and
`CsFile` derives each file-scoped `namespace` directive from its own
path. Module state is written idempotently at the top of `transform`,
never at entry construction.

## Conventions

- Every file opens with the `// <auto-generated/>` + `#nullable
  enable` pair — compiler-mandated, not stylistic (the auto-generated
  marker removes the file from the project's nullable context; a
  generated file using `?` without the directive fails with CS8669).
- `sealed` by default, `partial` always — hand-written members belong
  in a non-generated file of the same `partial` type (the no-stubs
  consumer seam).
- Visibility renders in BOTH states (`public` / `internal`) — C#
  types default to internal.
- Usings are explicit (no `ImplicitUsings` reliance), namespace-level,
  sorted, same-namespace-suppressed.
- A ref cycle of non-declarable schemas fails the item loudly (C# has
  no alias to break it); the run continues.

## Enrichments (CS-D)

Per refName under `["@skmtc/gen-csharp"][refName].main`:

- `name` — the model rename: aliases the identifier AND the file; ref
  sites, member base clauses, and the parent's
  `[JsonDerivedType(typeof(<Name>))]` arguments all follow; wire tags
  are unchanged.
- `discriminator.propertyName` — a UNION HINT upgrading an
  undiscriminated top-level union to the abstract-record mapping; tags
  come from each member's single-valued enum discriminator property
  (else refName). Members must CARRY the asserted property — an
  invalid hint fails the item loudly.
- `properties.<prop>.{ name, discriminator }` — the INLINE union hint
  (one level deep): the named parent is synthesized at its canonical
  path and the property is typed by it.

## Customization seams (clone to change)

| Seam | Location |
|---|---|
| Serialization flavor (`[JsonPropertyName]`/`[JsonIgnore]`/`[JsonExtensionData]`/`[JsonPolymorphic]`/enum converter → Newtonsoft) | `src/CsRecordValue.ts` + `src/CsEnumMembers.ts` + `src/CsPolymorphicParentValue.ts` — the only files that construct STJ attributes |
| Identifier naming / export layout | `src/base.ts` |
| Shape dispatch (what is declarable) + polymorphic qualifying predicate | `src/toCsProjection.ts`, `src/polymorphicMembership.ts` |
| Scalar/type mapping | `src/scalars.ts`, `src/CsPrimitives.ts` |
| Collection types (`IReadOnlyList` → `List`) | `src/CsArray.ts`, `src/CsObjectValue.ts` |

## Limits (documented, deliberate)

- Non-declarable refNames produce no artifact (D6) — a consumer
  wanting a named type for an array/map schema restructures it as an
  object or accepts the inlined expression.
- Undiscriminated unions are `JsonElement` until CS-D's union hints.
- Multi-parent polymorphic members fail loudly (one base record per
  C# record).
- `insertNormalizedModel` against the projections throws — insert by
  refName via `insertModel`; inline shapes synthesize internally.
- Unknown enum wire values throw on deserialize — for server request
  DTOs that is the contract working (a 400); open-enum patterns
  belong to a client generator, not here (kickoff A4).
