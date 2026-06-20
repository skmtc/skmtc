# `core/parse` — the OpenAPI parsers

SKMTC parses an OpenAPI document into the shared, version-agnostic `Oas*` IR
(`core/oas`). There is **one complete parser tree per OpenAPI dialect**, and
the dialect is chosen exactly once, at the top.

```
core/parse/
  toOasDialect.ts   the ONLY place an OpenAPI version is examined
  v3-0/             the OpenAPI 3.0 parser  (toDocument → … → toSchema → leaves)
  v3-1/             the OpenAPI 3.1 parser  (its own full tree)
core/oas/           the Oas* IR — the shared target both parsers build
```

## The one-time dialect split

`ParseContext.parse()` calls `toOasDialect(documentObject.openapi)` once and
routes the whole document to `v3-0` or `v3-1`. Detection is **explicit and
fails loud**: an unknown or missing version throws rather than silently
defaulting to a dialect (a `startsWith('3.1') ? … : …` fallback would route
every typo / `3.2` / `4.0` / missing field into 3.0 unnoticed). OpenAPI 3.1
is parsed natively and is **no longer down-converted** to 3.0 (`@skmtc/convert`
passes it through); only Swagger 2.0 is still converted upstream, by
`swagger2openapi`.

**Load-bearing invariant:** nothing below the split ever checks a version.
Every line is either version-specific code living in its own tree (it is
already in the right one) or a no-branch, dialect-neutral leaf. A 3.0
document reaching a line of 3.1 logic is therefore *structurally
impossible* — there is no branch condition to get wrong.

## Why two trees, not one parameterized parser

Duplication is deliberate (Option A). A single dialect-parameterized parser
spreads each dialect's behavior across leaf + injected strategy + wiring, and
turns a dialect bug from shallow ("this parser has a stale line" — local,
testable) into deep ("the shared leaf misbehaves for 3.1 only in some field
combination" — emergent). Reading one parser top-to-bottom in isolation beats
DRY at a dialect boundary. Drift between the duplicated trees is caught
behaviorally by a differential test corpus (`dialect-differential.test.ts` —
a 3.0 fragment and its 3.1 equivalent must parse to the same IR), not by
re-coupling the code.

## Shared vs duplicated

- **Shared** (in `core/oas`, no version branches): the `Oas*` constructors and
  the dialect-neutral leaf helpers — `_helpers/parseEnum`, `parseExample`,
  `parseDefault`; `_merge-all-of/`; `discriminator/toDiscriminatorV3`; format
  enums; sanitization. These take already-resolved inputs and never branch on
  a version, so they cannot cause spillover.
- **Duplicated** per tree: the schema dispatcher (`toSchema`), the
  per-type/leaf parsers, the operation layer, and `parseNullable`. These read
  version-specific encodings, so each tree owns its copy.

> Naming note: function names still carry the historical `V3` suffix (e.g.
> `toSchemaV3`) inside both trees; the rename to drop it is deferred. In
> particular `toRefV31` is the **dialect-neutral** ref parser used by *both*
> trees (the `V31` is a historical misnomer, not 3.1-specific) — it is a
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
type-less-object inference (above), and a number/integer `format` the IR's
format enum can't hold (dropped — the lost hint is informational). A custom
string `format` is spec-legal (open vocabulary) and preserved on the IR, so it
is not recorded at all; `callbacks` is a deliberate non-goal and dropped
silently in the operation parser.

## Known gaps / deferrals

- **No `OasNull` IR node.** Pure null (`type: 'null'` / `['null']`,
  `oneOf:[{type:'null'}]`) degrades to `OasUnknown`. A first-class `OasNull`
  is an additive IR enrichment for when a generator needs it.
- **`$ref` `summary`/`description` siblings** (3.1) are ignored — `OasRef`
  has no field for them yet.
- **Tuples (`prefixItems`) and closed objects (`unevaluatedProperties`)** are
  not parsed — they need an additive IR shape, added on demand when a
  generator can use the extra fidelity.
- **Conditional schemas (`if`/`then`/`else`, `dependentSchemas`,
  `patternProperties`)** are not mapped — a deliberate non-goal (rarely
  codegen-able); they fall through as skipped fields.
- **Document metadata (`info.summary`, `license.identifier`,
  `jsonSchemaDialect`, `$self`)** is not mapped to the IR; surfaced as
  skipped-field warnings. Minor.
