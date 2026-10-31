# `core/parse` — the OpenAPI parsers

SKMTC parses an OpenAPI document into the shared, version-agnostic `Oas*` IR
(`core/oas`). There is **one complete parser tree per OpenAPI dialect**, and
the dialect is chosen exactly once, at the top.

```
core/parse/
  toOasDialect.ts   the ONLY place an OpenAPI version is examined
  v3-0/             the OpenAPI 3.0 parser  (toDocument → … → toSchema → leaves)
  v3-1/             the OpenAPI 3.1 parser  (its own full tree)
  v3-2/             the OpenAPI 3.2 parser  (its own full tree, copied from v3-1)
core/oas/           the Oas* IR — the shared target every parser builds
```

## The one-time dialect split

`ParseContext.parse()` calls `toOasDialect(documentObject.openapi)` once and
routes the whole document to `v3-0`, `v3-1` or `v3-2`. Detection is
**explicit and fails loud**: an unknown or missing version throws rather than
silently defaulting to a dialect (a `startsWith('3.1') ? … : …` fallback would
route every typo / `4.0` / missing field into 3.0 unnoticed). OpenAPI 3.1 and
3.2 are parsed natively and are **not down-converted** to 3.0
(`@skmtc/convert` passes them through); only Swagger 2.0 is still converted
upstream, by `swagger2openapi`.

**Load-bearing invariant:** nothing below the split ever checks a version.
Every line is either version-specific code living in its own tree (it is
already in the right one) or a no-branch, dialect-neutral leaf. A 3.0
document reaching a line of 3.1 logic is therefore *structurally
impossible* — there is no branch condition to get wrong.

## Why one tree per dialect, not one parameterized parser

Duplication is deliberate (Option A). A single dialect-parameterized parser
spreads each dialect's behavior across leaf + injected strategy + wiring, and
turns a dialect bug from shallow ("this parser has a stale line" — local,
testable) into deep ("the shared leaf misbehaves for 3.1 only in some field
combination" — emergent). Reading one parser top-to-bottom in isolation beats
DRY at a dialect boundary. Drift between the duplicated trees is caught
behaviorally, not by re-coupling the code:

- `dialect-differential.test.ts` — a 3.0 fragment and its 3.1 and 3.2
  equivalents must parse to the same IR.
- `v3-2/version-equivalence.test.ts` — two real 3.1 documents
  (`core/_schemas/openrouter.yaml`, `core/_schemas/remote-com.json`) parsed
  as `3.1.0` and as `3.2.0` must give the same document, the same component
  maps and the same error-level issues.

## Shared vs duplicated

- **Shared** (in `core/oas`, no version branches): the `Oas*` constructors,
  format enums and sanitization.
- **Duplicated** per tree: the schema dispatcher (`toSchema`), the
  per-type/leaf parsers, the operation layer, and `parseNullable`. These read
  version-specific encodings, so each tree owns its copy.
- **Duplicated, but dialect-neutral**: the parser leaves `_helpers/`
  (`parseEnum`, `parseExample`, `parseDefault`) and `_merge-all-of/`. They
  take already-resolved inputs and never branch on a version, yet each tree
  holds its own copy, so they now exist in three copies. Moving them to one
  shared place is deferred. `discriminator/toDiscriminatorV3` was in this
  list until the v3-2 copy started to read the 3.2 `defaultMapping`; the
  v3-0 and v3-1 copies are still identical to each other.

> Naming note: function names still carry the historical `V3` suffix (e.g.
> `toSchemaV3`) inside every tree; the rename to drop it is deferred. In
> particular `toRefV31` is the **dialect-neutral** ref parser used by *every*
> tree (the `V31` is a historical misnomer, not 3.1-specific) — it is a
> public `mod.ts` export, so renaming it to `toRef` is a coordinated breaking
> change folded into the broader suffix cleanup, not done piecemeal. The
> `Oas*` prefix on the IR is kept — it is "our OpenAPI-family IR", the
> canonical version-agnostic target, *not* "the v3 model".

## Dialect differences (v3.0 vs v3.1)

How each genuinely-divergent construct is handled in each tree. The shared
`Oas*` IR is the common output; the parsers differ only in how they read the
wire form into it.

| Construct | v3.0 (`v3-0`) | v3.1 (`v3-1`) | Status |
|---|---|---|---|
| Nullable scalar | `nullable: true` keyword | `type: ['T', 'null']` → IR `nullable` flag | ✅ done |
| Multi-type union | not expressible | `type: ['T1','T2']` → `OasUnion` (CASE 2) | ✅ done |
| Nullable union | `nullable` keyword on the combinator | `{type:'null'}` member folded out → IR `nullable` | ✅ done |
| Nullable `$ref` | `oneOf:[{$ref}], nullable:true` → nullable `OasRef` | `oneOf:[{$ref},{type:'null'}]` → nullable `OasRef` | ✅ done |
| Pure null (`type:'null'` / `['null']`) | n/a | falls through to `OasUnknown` — no `OasNull` IR node yet | ⏳ gap |
| Literal (`const`) | single-`enum` | `const:X` → `enum:[X]` → leaf | ✅ done |
| `exclusiveMin/Max` | boolean (+ `minimum`) | numeric bound → boolean + `minimum`/`maximum` | ✅ done |
| Schema `examples` | `example` (singular) | `examples` array → `examples[0]` as IR `example` | ✅ done |
| Binary / base64 string | `format: binary`/`byte` | `contentMediaType: application/octet-stream` → `format: binary`; `contentEncoding: base64` → `format: byte` | ✅ done |
| `paths` requiredness | required | optional (webhooks-only docs) → `operations: []` | ✅ done |
| Type-less object (`properties`, no `type`) | infers `object`; records `MISSING_OBJECT_TYPE` at `debug` (3.0 requires `type`) | infers `object` silently (`type` optional in 3.1) | ✅ done |
| `$ref` siblings (`summary`/`description`) | ignored | ignored (no IR field yet) | ⏳ deferred |
| Webhooks | n/a (3.0 has no webhooks) | native, from the raw doc | ✅ |

### Nullability — the shared mechanism

Both trees represent nullability the same way in the IR: a `nullable` flag the
leaf parsers read via `parseNullable`. The trees differ only in where that
flag comes from:

- **v3-0** reads the literal `nullable` keyword, and (for the canonical 3.0
  nullable-reference idiom) hoists `nullable` from a single-member
  `oneOf`/`anyOf` wrapper onto the surviving member / `OasRef`.
- **v3-1** has no `nullable` keyword. `normalizeTypeArray` turns
  `type: ['T','null']` into `{ type: 'T', nullable: true }`, and
  `partitionNullMember` folds a `{type:'null'}` member of a `oneOf`/`anyOf`
  into the same flag. After that folding, v3-1 reuses the same
  collapse/union/leaf logic.

Multi-type arrays (`type: ['string','number']`) are modelled as a `oneOf` of
the bare types, so the existing union machinery builds the `OasUnion`. A
multi-type array carrying type-specific constraints (e.g. `maxLength` next to
`['string','number']`) keeps the shared annotations on the union and does not
distribute per-type constraints to the members — a rare case, noted here.

## Dialect differences (v3.1 vs v3.2)

OpenAPI 3.2 is a superset of 3.1, and its schema-layer changes are additive. `v3-2` started
as a copy of `v3-1`; the 3.2 fields are added to it one at a time. Until a
field is read into the IR, the parser records it as a skipped-field warning
(`UNEXPECTED_PROPERTY`) and the parse continues. `v3-2/pending-fields.test.ts`
holds one case per row: a skipped-field warning for a pending row, and the
IR value with no warning for a done one.

All three security-scheme parsers record unknown keys on a security scheme
and on its `flows` object as skipped-field warnings. The shared valibot
schemas in `oas/securitySchemes/security-scheme-types.ts` are the 3.0/3.1
shape; `v3-2` extends them with the 3.2 fields, so on a 3.0 or 3.1 document
those fields warn and stay off the IR.

`components.mediaTypes` is resolved at parse time: `toMediaTypeItemsV3`
replaces a `content` entry whose `$ref` points into it with the referenced
Media Type Object, then parses that like an inline one. An entry that is
itself a `$ref` is followed. A `$ref` that does not resolve to a Media Type
Object there (a missing entry, a pointer elsewhere, or a chain of entries
that loops back on itself) logs `INVALID_DEPENDENCY_REF` at that content
entry and drops it. The map is not stored on `OasComponents`
and `OasRef` has no `mediaType` bucket: a resolved entry carries the same IR
as an inline one, so generators read media types the same way in both
cases and never need to resolve a media type reference themselves.

`$self` is stored, but reference resolution does not use it: `toRefName`
keeps only the last segment of a `$ref` and ignores the rest of the URI, so
the 3.2 base-URI rules (Appendix F of the spec) are not implemented.

| 3.2 field | v3.2 (`v3-2`) | Status |
|---|---|---|
| Document `$self` | `OasDocument.$self`, stored as a string only (see below) | ✅ done |
| Path item `query` operation | an operation with method `query` | ✅ read |
| Path item `additionalOperations` | one `UNSUPPORTED_OPERATION_METHOD` warning per entry; the operation is dropped | ✅ warned |
| Parameter `in: querystring` | read; must carry `content` with exactly one media type and no `schema` (`INVALID_PARAMETER` error otherwise, the parameter is dropped); a second `querystring`, or one with `in: query`, is an `INVALID_PARAMETER` warning | ✅ read |
| Parameter `style: cookie` | read for `in: cookie` (default `explode: true`). On another location it fails like any invalid parameter: on an operation, the operation is dropped; on a path item or webhook path item, the whole path is dropped (`INVALID_OPERATION`); under `components.parameters`, the parameter is dropped (`INVALID_PARAMETER`) | ✅ read |
| Media type `itemSchema` | `OasMediaType.itemSchema` (schema or ref) | ✅ done |
| Media type `prefixEncoding` / `itemEncoding` | stored as-is on `OasMediaType`; a warning when `encoding` is also present | ✅ done |
| `components.mediaTypes` | resolved into each `content` entry that references it | ✅ done |
| Response `summary` | `OasResponse.summary` | ✅ done |
| Example `dataValue` / `serializedValue` | `OasExample.dataValue` / `serializedValue`. `value` cannot sit next to any other value field, and `serializedValue` cannot sit next to `externalValue`; the field that loses is dropped with `INVALID_EXAMPLE`, by precedence `dataValue`, `value`, `serializedValue`, `externalValue` | ✅ done |
| Tag `parent` / `kind` / `summary` | `OasTag.parent` / `kind` / `summary`. A `parent` that is not a tag, or that leads back to the tag, is dropped with `INVALID_TAG_PARENT` | ✅ done |
| Server `name` | `OasServer.name` | ✅ done |
| Discriminator `defaultMapping` | `OasDiscriminator.defaultMapping` | ✅ done |
| Security scheme `deprecated` / `oauth2MetadataUrl` | on the security scheme IR | ✅ done |
| OAuth flow `deviceAuthorization` | `flows.deviceAuthorization` on `OasOAuth2SecurityScheme` | ✅ done |

## Diagnostic levels

Parse issues carry one of three severities (`core/context/ParseIssue.ts`):

- **`error`** — the input is broken; the item is dropped and its `$ref`
  consumers pruned. Drives the run's exit status.
- **`warning`** — a real deviation that was handled (e.g. `additionalProperties`
  on a non-object schema).
- **`debug`** — informational: the parser handled the input gracefully and is
  recording what it assumed or dropped. Recorded on the manifest but filtered
  from the default view; never affects exit status.

`debug` keeps the record without the noise. Routed here: the v3-0
type-less-object inference (above), a number/integer `format` the IR's
format enum can't hold (dropped — the lost hint is informational), and
`NO_JSON_MEDIA_TYPE` (a body whose keys include a media type range that no
lookup reads). A custom
string `format` is spec-legal (open vocabulary) and preserved on the IR, so it
is not recorded at all; `callbacks` is a deliberate non-goal and dropped
silently in the operation parser.

## Known gaps / deferrals

- **No `OasNull` IR node.** Pure null (`type: 'null'` / `['null']`,
  `oneOf:[{type:'null'}]`) degrades to `OasUnknown`. A first-class `OasNull`
  is an additive IR enrichment for when a generator needs it.
- **`$ref` `summary`/`description` siblings** (3.1) are ignored — `OasRef`
  has no field for them yet.
- **Tuples (`prefixItems`)** are not parsed — they need an additive IR
  shape, added on demand when a generator can use the extra fidelity.
- **`unevaluatedProperties` next to `allOf`/`oneOf`/`anyOf`** is not mapped.
  The parser removes it from the wrapper before the merge and records an
  `UNEXPECTED_PROPERTY` warning. With none of `allOf`, `oneOf`, `anyOf`,
  `if`, `then`, `else`, `dependentSchemas` or `$dynamicRef` on the schema, it
  is read as `additionalProperties`. When the schema also has
  `additionalProperties`, that keyword is kept and `unevaluatedProperties` is
  dropped without a warning.
- **Conditional schemas (`if`/`then`/`else`, `dependentSchemas`,
  `patternProperties`)** are not mapped — a deliberate non-goal (rarely
  codegen-able); they fall through as skipped fields.
- **Document metadata (`info.summary`, `license.identifier`,
  `jsonSchemaDialect`)** is not mapped to the IR; surfaced as skipped-field
  warnings. Minor. (The 3.2 `$self` is mapped; see the 3.2 table.)
