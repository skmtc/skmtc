# 2026-05-13 — Form enrichment growth + delegate-pattern refactor

Same-day continuation of `2026-05-13-edit-form-gate.md`, but distinct
focus: a delegate-pattern refactor of `ShadcnForm` (replacing an
if-cascade in toString with discriminated delegates), the addition of
static + dynamic defaults primitives (`defaultValue` per field +
`defaultsHook` per form, with a generalised "Gate" applying to both
PATCH-hydration and POST-defaults), and a push to recreate a complex
hand-written body (`LineItemFormBody`) entirely via enrichment — which
worked, with six narrowly-scoped new concepts.

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | Orchestrator-delegate pattern for multi-variant Projections | win | open |
| 2 | Lens-type variance traps mid-stack "fix it at form-values" redesigns | friction | open |
| 3 | Form-level `includesValues` decouples "what the form holds" from "what it renders" | win | open |
| 4 | Composite-field contracts belong on the component's TYPE, not in generator state | win | open |
| 5 | Reflexive `bodyComponent` escape hatch under-estimated the enrichment ceiling | friction | open |

---

### 1. Orchestrator-delegate pattern for multi-variant Projections [win]

`ShadcnForm` had grown three emission shapes — simple POST/PUT wrapper,
PATCH-with-GET-sibling Gate, and POST/PUT-with-`defaultsHook` Gate.
First implementation used boolean flags + optional fields:

```ts
class ShadcnForm extends ShadcnFormBase {
  isPatchGate: boolean
  isDefaultsGate: boolean
  shellName: string | undefined
  valuesFromName: string | undefined
  paramsHookName: string | undefined
  getQueryHookName: string | undefined
  defaultsHookName: string | undefined
  // …plus hookName = '' and bodyName = '' as sentinels for variants
  // that don't use them

  override toString(): string {
    if (this.isPatchGate) return this.toGateString()
    if (this.isDefaultsGate) return this.toDefaultsGateString()
    return this.toCreateString()
  }
}
```

The user pointed at `gen-tanstack-query-supabase-zod/src/TanstackQuery.ts`
as a reference. Its pattern:

```ts
export class TanstackQuery extends TanstackQueryBase {
  client: PaginatedQueryEndpoint | QueryEndpoint | MutationEndpoint
  constructor(args) {
    super(args)
    this.client = match(args.operation)
      .with({ method: 'get' }, () => isListResponse(op)
        ? new PaginatedQueryEndpoint(args)
        : new QueryEndpoint(args))
      .otherwise(() => new MutationEndpoint(args))
  }
  override toString(): string { return this.client.toString() }
}
```

The orchestrator picks one delegate at construction; `toString` is pure
delegation. Each delegate is a complete class extending the same base,
carrying ONLY its own fields. Refactored `ShadcnForm` to the same shape:
`decideFormVariant` (pure function → discriminated union), `match(...).
with(...).exhaustive()` in the constructor, three concrete classes
(`ShadcnFormCreate`, `ShadcnFormPatchGate`, `ShadcnFormDefaultsGate`)
each holding only its own state.

**Why it matters:** The orchestrator pattern makes invalid states
**structurally impossible**. A `ShadcnFormPatchGate` instance is
type-guaranteed to have `shellName`, `paramsHookName`, etc.; it has no
`hookName` field at all. The class that needs `hookName` (Create) has
no `shellName`. No sentinel `''`, no `string | undefined` fields,
no boolean-flag combinatorics. `.exhaustive()` provides compile-time
coverage — adding a fourth variant requires updating both the
discriminated union and the match, or TS fails.

Three forces converge here, and they're worth naming because they
recur:
1. **Cache-key stability requires one Projection.** The cache key is
   `(identifier.name, exportPath)` — splitting into three classes
   with three identifiers would either fragment the name (`FormGate`,
   `FormPatchGate`, `FormDefaultsGate`) or risk collisions. Single
   orchestrator preserves the public name.
2. **Output shape variance benefits from discriminated unions.**
   Optional fields + flag booleans collapse multiple shapes into one
   class; the type system can't help. Delegate union narrows to one
   concrete shape at a time.
3. **`toString` shouldn't branch on state set elsewhere in the
   constructor.** Once you have an if-cascade in toString reading
   constructor-set flags, the type system has stopped helping you. The
   delegate pattern removes the branch: `toString()` is just
   `this.delegate.toString()`.

Refines `2026-05-13-edit-form-gate.md` #2 — that entry concluded "keep
identifier stable, branch inside toString." Today's lesson refines the
"branch inside toString" part: branch via *delegate composition*, not
via flag-driven if-cascades.

**Possible fixes:** unresolved — could be a `skmtc-generator` skill
section ("multi-variant Projection authoring") with the
orchestrator-delegate template as the canonical pattern. Could
cross-reference `gen-tanstack-query-supabase-zod` as the in-tree
reference. Could also be added to `concepts/` as a design pattern
write-up.

**Version anchor:** `@skmtc/core@^0.3.x`, custom `gen-shadcn-form`,
reference: `@skmtc/gen-tanstack-query-supabase-zod`

**Status:** open

---

### 2. Lens-type variance traps mid-stack "fix it at form-values" redesigns [friction]

The line-item form's number fields (`unitPrice`, `quantity`, `taxRate`,
`estimatedTimeMinutes`) ran into a lens-variance wall:

- Form values type was `Required<Pick<EditCustomerFormInput, ...>>` →
  `quantity: number` (strict)
- `NumberField` declares `lens: Lens<number | null>` because the input
  has a real "cleared" runtime state (user clears → `field.onChange(null)`)
- `Lens<T>` is **invariant** in `T` — `Lens<number>` is not assignable
  to `Lens<number | null>`

First instinct: "widen form values to match what the runtime
fields actually hold." Added `toFormFieldType` helper to emit per-field
TS expressions, made numbers `number | null` in `FormValuesType`. This
broke alignment downstream:

```
src/components/forms/EditCustomerForm.generated.tsx:
  Type 'Resolver<{ customerType: ..., companyName: string | null,
    firstName: string, ... }, any, { ... }>' is not assignable to type
  'Resolver<EditCustomerFormValues, any, EditCustomerFormValues>'.
```

The zod resolver is built from the body schema via `.pick().required()`
and its inferred `out` type came from the OpenAPI schema (which has
`firstName: string`, not `string | null`). Widening the values type
without ALSO widening the resolver — which would mean replacing
`.required()` with a hand-built schema per visible field — broke every
`useForm<Values>` call site. Cascaded into `UseFormReturn` mismatches
in the body component too.

Reverted all of it. Made `NumberField`, `PercentageField`, `TaxRateField`
**generic** over `T extends number | null` instead — same pattern
`TaxableField` already used:

```ts
export type NumberFieldProps<T extends number | null> = { lens: Lens<T>; ... }
type NumberFieldImplProps = NumberFieldProps<number | null>
export const NumberField = <T extends number | null>(props: NumberFieldProps<T>) => {
  return <NumberFieldImpl {...(props as unknown as NumberFieldImplProps)} />
}
```

**Why it matters:** The instinct "fix the type incompatibility at the
form-values level" was wrong because form-values lives at the
intersection of TWO type-flow constraints — the zod resolver (which
derives from the body schema) AND the field components (which want
runtime-faithful lens types). Pulling on one end snapped the other.

The right layer was the field component itself: generic over a wider
shape, so both `Lens<number>` (strict, from form-values) AND
`Lens<number | null>` (loose, used elsewhere) parameterise the same
component. The `as unknown as` impl-cast is contained in the field
component's tiny wrapper; the public API is type-safe. This is what
`TaxableField` was already doing — and the pattern generalises to any
field whose runtime "empty" state can't be expressed in the schema's
type.

The reflex "widen the form-values type" optimises for one constraint
in isolation and ignores the resolver constraint. The bidirectional
flow (schema → resolver type, schema → values type, values type →
field types) forms a closed loop; you can't unilaterally change one
node without breaking the others.

**Possible fixes:** unresolved — could be a `skmtc-generator` skill
note on the "lens-variance trap" with the pattern (`<T extends Shape>`
generic field components) as the recommended fix. Could also be a
`concepts/` entry on the "type-flow loop" between schema → resolver
→ values → fields, and which node is safe to modify.

**Version anchor:** `@skmtc/core@^0.3.x`, custom `gen-shadcn-form`,
@hookform/lenses

**Status:** open

---

### 3. Form-level `includesValues` decouples "what the form holds" from "what it renders" [win]

Recreating `LineItemFormBody` required `TaxableField` to render *both*
`isTaxable` and `taxRate` (the composite owns both inputs). The
generator needed to:

1. Include both fields in the form's pick / values / EMPTY_VALUES
   (so `useForm` holds them and the resolver validates them)
2. Render ONE component (TaxableField) for the row, not two separate
   field renders

Two iterations of the design felt forced:

**Iteration A: per-field `renderedBy: 'isTaxable'`** on the absorbed
field. Two cross-referenced entries in `rows`; the relationship spans
multiple enrichment locations.

**Iteration B: per-composite `absorbs: ["taxRate"]`** on the parent
field. Co-located but conflates "which fields the form holds" with
"which fields this component renders" — the composite's contract is
already in its TYPE (`<T extends TaxableShape>`), the generator just
needs *enough* info to wire form-state correctly.

The user steered to Option C: **a form-level `includesValues: string[]`**
listing field IDs the form HOLDS but doesn't render as separate rows.
`rows` becomes purely the render-list; `includesValues` is the
additional-values-list:

```json
"includesValues": ["taxRate"],
"rows": [
  …
  [{ "id": "isTaxable", "component": { …TaxableField…, "style": "parent-lens" } }]
]
```

**Why it matters:** Cleanly separates two orthogonal concerns:
- **What the form's value-shape is** (drives `pick`/values type/EMPTY_VALUES)
- **What the form renders separately** (drives the body's JSX)

In simple forms these collapse — every held field is rendered, every
rendered field is held. For composites they diverge — the composite's
component renders *multiple* held fields. `includesValues` is the
narrow primitive that captures the divergence without complicating
the per-field config or introducing cross-references.

Per-field `renderedBy` and per-composite `absorbs` both pretended the
relationship lived between fields. It actually lives between **field
set** and **render set**, which is form-level. Pull the concept up to
the form level and it stops being awkward.

A general principle: when a per-row or per-field flag feels like it
encodes a *relationship* (this depends on that), check whether the
relationship is actually between two collections — and if so, lift the
flag to whichever level owns those collections.

**Possible fixes:** unresolved — could be documented as part of the
enrichment-schema reference. Could also generalise: are there other
"two collections" concepts in enrichment that should be lifted? E.g.,
`refinements` are form-level (a relationship between values). The
pattern is already there; this is one more instance of it.

**Version anchor:** `@skmtc/core@^0.3.x`, custom `gen-shadcn-form`

**Status:** open

---

### 4. Composite-field contracts belong on the component's TYPE, not in generator state [win]

`TaxableField` is a composite — one component, two form values. The
question was: how does the generator know the lens-shape contract
TaxableField requires?

Answer: **it doesn't need to**. TaxableField's TypeScript signature
encodes the contract:

```ts
type TaxableShape = { isTaxable: boolean; taxRate?: number }
export const TaxableField = <T extends TaxableShape>(props: { lens: Lens<T> }) => { … }
```

When the generator emits `<TaxableField lens={lens} />` where
`lens: Lens<FormValues>`, TypeScript infers `T = FormValues` at the
consumer's compile-time and checks `FormValues extends TaxableShape`.
A form whose values are missing `isTaxable` or `taxRate` fails to
compile at the call site of the generated form, not at generation.

The generator only needs to know:
1. **Which component to render** (`component` enrichment)
2. **That the component takes the body's full lens, not a focused one**
   (`style: 'parent-lens'` — the *one* generator-side hint)
3. **Which additional fields go into the form values** (`includesValues`,
   per entry #3)

That's it. No "this composite consumes fields X, Y, Z" metadata in
the enrichment. No type-introspection at generate time. The
component's generic constraint does the heavy lifting; the generator's
job is mechanical.

**Why it matters:** This is the deeper version of `2026-05-13-edit-form-gate.md`
#1 (TS inference for cross-generator type coupling). Same principle in a
different costume: **the generator doesn't need to know things TypeScript
can already enforce at the consumer's compile-time**. Pull contracts into
the consumer's type system; the generator just emits the value
references.

Concretely: a generator that tried to encode "TaxableField consumes
isTaxable+taxRate" in enrichment would couple the enrichment to a
specific component's internals. A regenerate with a renamed
`isTaxable` → `taxEnabled` would silently emit a broken form (the
component would `lens.focus('isTaxable')`, the form would have
`taxEnabled` instead, runtime undefined). The TYPE-level encoding
fails at compile-time on the regenerate, surfacing the
incompatibility immediately.

A general pattern for composite/multi-value component overrides:
- Component author defines a structural shape (`type Shape = {...}`)
- Component is generic: `<T extends Shape>({ lens: Lens<T> })`
- Generator's enrichment only declares "use this component, pass the
  body lens, include these extra values"
- TS enforces the rest

**Possible fixes:** unresolved — could be a `skmtc-generator` skill
section on "component-driven contracts" pairing with `2026-05-13-edit-form-gate.md` #1's
"by-inference" pattern. Could also be a `concepts/` entry on the
"generator-side vs consumer-side type knowledge" boundary.

**Version anchor:** `@skmtc/core@^0.3.x`, custom `gen-shadcn-form`

**Status:** open

---

### 5. Reflexive `bodyComponent` escape hatch under-estimated the enrichment ceiling [friction]

When the line-item form's complexity surfaced (Collapsible description,
4-col grid with col-span, composite TaxableField, Separators between
groups, helper text), my first proposal was a `bodyComponent`
enrichment — let the consumer write the entire body as a React
component, skip generating the body, keep everything else generated.

I argued at length that the enrichment schema was about to bloat
("Collapsible today, Tabs tomorrow, Accordions next…") and that an
escape hatch was the right answer.

The user pushed back: "try your enrichment based suggestion. how
close can you get current implementation?"

Working through it, six narrowly-scoped additions covered the entire
hand-written body:

| Addition | Scope |
|---|---|
| `description` per field | Helper text below input |
| `kind: 'separator'` row variant | `<Separator />` between rows |
| `collapsible: { trigger }` per field | `<Collapsible>` wrapper, srOnly inner label |
| `colSpan` per field | Grid column span, sum drives row's `grid-cols-N` |
| `style: 'parent-lens'` on component | Pass body lens, not focused |
| `includesValues` per form | Field IDs held but not separately rendered |

Result: pixel-identical to the hand-written body, type-safe, no
runtime behaviour gap.

**Why it matters:** The "enrichment will become JSON-as-JSX" fear was
real, but I miscalibrated *where* the threshold sits. Each of the six
additions is:
- Single-purpose (one concept per primitive)
- Narrow (not a config bag like `componentProps: { rows: 2, min: 0 }`)
- Type-discriminated (separator vs field row via `kind`)
- Schema-stable (no per-component knowledge leaking in)

The componentProps bag I argued against would have crossed into
JSON-as-JSX. But concepts at the layout-primitive level (separators,
column spans, wrappers like Collapsible) are still narrowly purposeful
— they're not "pass any prop to any component," they're "express layout
verbs the form vocabulary lacks."

The reflex to reach for escape hatches when schema growth feels
imminent is well-meaning but can prematurely concede expressiveness
that's still cleanly bounded. **The ceiling on enrichment isn't "any
new concept is bloat" — it's "concepts that pretend to be schema but
are actually code."** componentProps fails that test; named layout
primitives pass it.

A heuristic for future judgement calls: a proposed enrichment is
*schema-shaped* when (a) the concept is generator-side (not
component-side), (b) it has a single, well-defined emit-time decision,
and (c) it doesn't take arbitrary key-value blobs. Concepts that fail
any of these are *code-shaped* and belong in a `bodyComponent` escape
hatch instead.

**Possible fixes:** unresolved — could be a `skmtc-generator` skill
section on "when to add a schema primitive vs use a bodyComponent
escape hatch." Could also be a `concepts/` entry on "schema-shaped vs
code-shaped concepts" as a design criterion. The line-item form is
the in-tree example of how far enrichment can stretch.

**Version anchor:** `@skmtc/core@^0.3.x`, custom `gen-shadcn-form`

**Status:** open
