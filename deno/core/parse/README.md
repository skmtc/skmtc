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
  `parseDefault`; `discriminator/toDiscriminatorV3`; format enums;
  sanitization. These take already-resolved inputs and never branch on a
  version, so they cannot cause spillover.
- **Duplicated** per tree: the schema dispatcher (`toSchema`), the
  per-type/leaf parsers, the operation layer, `parseNullable`, and
  **`_merge-all-of/`**. These read version-specific encodings, so each tree
  owns its copy.

> `_merge-all-of/` was long *described* as shared while the code kept two
> copies. The code was right. The merge reads `type`, and 3.1 allows `type` to
> be a LIST — `['string','null']` is 3.1's nullable string, where 3.0 writes a
> single string plus `nullable: true`. Two checks (`check-type-conflicts` and
> `check-at-least-one-type-match`) compared it with `===`, so two identical
> lists never matched and every such merge was refused. The v3-1 copies are
> set-based; the v3-0 copies are not, because 3.0 cannot produce the case.
> Merging the trees would have put a version conditional inside code whose
> whole design is to never ask which version it is handling. The two copies
> were byte-identical for a long stretch — that was a coincidence of timing,
> not evidence they should be one.

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

## Combinator squash — `allOf` / `oneOf` / `anyOf`

**All three are resolved during parse. Generators never see a combinator.**

That is not a preference, it is forced by the IR:

```ts
export type OasSchema =
  | OasArray | OasBoolean | OasInteger | OasNumber
  | OasObject | OasString | OasUnknown | OasUnion
```

There is no `allOf` node and no intersection node, so there is nowhere to defer
the work to. `_merge-all-of/` exists to do it, and the only real question is how
well it squashes. Note also that **the spec does not help here**: OpenAPI defines
`allOf`/`oneOf`/`anyOf` as *validation* keywords and says nothing about merging
them, so there is no "correct output" to look up. The property that *is*
specified is validation, which is why changes here are checked with a
verdict-equivalence harness (below).

### The rule for a `$ref` inside `allOf`

> A `$ref` survives as an `OasRef` unless the intersection actually changes its
> shape. Only a shape-changing merge inlines.

A reference is a claim — "the value here satisfies exactly the named schema".
Keeping it is correct precisely when that claim survives the squash:

| case | outcome | why |
|---|---|---|
| `allOf:[{$ref: X}]` alone | ref survives | the value must satisfy exactly `X` |
| `$ref` that closes a cycle | ref survives | no finite inlining exists; `OasRef` resolves lazily at use time |
| `allOf:[{$ref: X}, {structural}]` | **inlined**, name lost | the merged shape is no longer `X`; emitting a reference to `X` would lie about the contract |

The name is lost in the third row because the name no longer applies. Losing it
is harmless in TypeScript (structural typing keeps the flat object assignable)
and lossy in a nominal language — but the Kotlin generators want the flattened
data class anyway (data classes are final), and their polymorphism comes from
discriminated `oneOf` → sealed interfaces, which never routes through the merge.

### `anyOf` is parsed as `oneOf`

Both spellings reach `toUnionSchema` and merge under one keyword. They already
converged in the IR — `OasUnion` records no source keyword and `toJsonSchema`
emits `oneOf` for both — so maintaining two dispatcher branches preserved a
distinction nothing downstream could observe.

It is not free of meaning: `oneOf` is exactly-one, `anyOf` is at-least-one, so a
value matching two `anyOf` members is valid under `anyOf` and not under `oneOf`.
Codegen cannot express the difference (it deserialises into one shape either
way), and Stainless and Speakeasy both make the same collapse deliberately —
Speakeasy explicitly to avoid an explosion of types.

`parentType` still carries the author's keyword so stack trails and
skipped-field messages name what they actually read.

One observable consequence: **nested unions now flatten.** An `anyOf` whose
member carries a `oneOf` used to nest and now merges into one union — same
leaves, one level shallower, and no discriminators lost.

### Cycle handling

A schema reachable from itself has no finite expansion. `buddy-api`'s
`TargetView` is the worked example: a `oneOf` of 18 variants where each variant
is `allOf: [{$ref: TargetView}, …]`. Expanding one variant re-expanded all
eighteen — base-18 growth, unbounded depth. It took the docs pages down with
`exceededMemory`, which never reaches Sentry.

Two mechanisms keep it finite, and both are load-bearing:

1. **A path-scoped set of `$ref`s being expanded**, carried on the resolver
   itself (`ref-cycle.ts`) so the modules that merely forward `getRef` propagate
   it without knowing it exists. Re-entering a ref on the path leaves it as a
   ref. **Path-scoped, never global** — a schema referenced twice in sibling
   positions must expand in both, and a global set would leave the second a bare
   ref, changing output for acyclic documents.
2. **`mergeWithRef` routes resolved schemas through `mergeSchemasOrRefs`, not
   `mergeSchemas`.** Only the former dispatches on `allOf`/`oneOf`. Without it a
   referent's `allOf` was copied through by `typedMerge` into its output, escaped
   *upward* in the data, and re-triggered expansion at a frame whose resolver had
   none of the path — the marker is scoped to the descent, the unconsumed `allOf`
   outlived it.

`mergeCrossProduct` deliberately does **not** swallow `RangeError`. Dropping a
cross-product branch on a genuine conflict is the design — a cross product holds
impossible combinations — but swallowing a stack overflow turned a fast failure
into a very long exponential search with union members silently vanishing.

### Union-level keys

`decomposeUnion` keeps metadata keys **on the union** rather than merging them
into each member, because merging a key *into* a member resolves `$ref` members
to do it and loses their names. The named list can only cover keys OpenAPI
defines, so **`x-` vendor extensions are excluded too**. Without that, OpenAI's
`AssistantStreamEvent` had the union's own `x-oaiMeta` group label overwrite all
25 events' `x-oaiMeta.dataDescription` — 23 distinct descriptions collapsed into
one.

Precedence is positional and worth knowing: `decomposeUnion` splits the parent's
keys at the union keyword, and keys *after* the split merge in as `second`, so
they win over the member's.

### The Stripe carve-out

Stripe spells an expandable field as `anyOf: [string, {$ref}]` carrying
`x-expansionResources` — "the id, or the expanded object". That branch bypasses
the merge entirely so the members keep their names. It may become deletable if
refs survive composition generally; if it does, that is good evidence the
general rule is right.

### Known costs, not yet addressed

- **Distribution is unbounded.** `allOf[{oneOf:[A,B]}, X]` becomes
  `oneOf:[A&X, B&X]` — disjunctive normal form, and the only shape the IR can
  hold. It is correct, and exponential in the number of union factors. Bounding
  it (and refusing rather than emitting a widened type, as `not` already does) is
  skmtc#117.
- **Single-member `allOf` wrappers discard use-site annotations.**
  `allOf:[{$ref: X}], description: d` keeps the ref and drops the description —
  ~2,600 sites across a fifth of a sampled corpus. skmtc#118.

### Changing any of this

Two harnesses, both **dialect-aware** (pick the tree from `document.openapi`, as
`ParseContext.parse` does — an earlier version ran everything through v3-0 and
reported five phantom regressions on 3.1 documents):

1. **Validation equivalence.** Compile the original and merged schema with ajv
   and require identical verdicts on spec-authored `example` payloads. This is
   the closest thing to ground truth, because validation is the only part the
   spec defines. It **cannot** see annotation changes — those do not validate.
2. **Reference implementation.** `npm:json-schema-merge-allof` on the same
   inputs, comparing properties and required.

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
