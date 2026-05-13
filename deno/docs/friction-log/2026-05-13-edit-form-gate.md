# 2026-05-13 — Edit-form Gate pattern for PATCH operations

Session built a PATCH-mode "Gate" layer in `gen-shadcn-form`: when an
operation has method=patch and a GET sibling at the same path, the
public `<FormName>` component auto-wires hydration (params → query →
DTO mapper → defaultValues) and only renders the inner Shell once data
resolves. POST/PUT keep their existing simple-wrapper emission. The
hook also gained PATCH-mode submit handling: dirty-fields filter plus
nullable-string `'' → null` translation.

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | DTO type via TS inference from query hook return type | win | open |
| 2 | Method-aware emission via single Projection branching | win | open |
| 3 | Inline per-field emission beats runtime helper for known field sets | win | open |
| 4 | Cross-form refinement signature coupling | friction | open |
| 5 | `context.document.value.operations.find` is the canonical sibling-discovery primitive | win | open |

---

### 1. DTO type via TS inference from query hook return type [win]

PATCH-mode emission needs a DTO → form-values mapper. The mapper's
input parameter is the GET sibling's response shape — but the
generator doesn't need to know that schema at generate time.

**What happened:** I considered three paths for the mapper's input
type:

1. Navigate the OpenAPI response: locate `responses['200'].content[...]
   .schema`, drill into `properties.data`, pass to `TsProjection.
   insertNormalizedModel`. Requires real OAS-side navigation.
2. Emit a synthetic `EditCustomerFormDto` type alias derived from the
   visible-field set + body schema. Duplicates the API DTO shape;
   needs the generator to walk the schema in TS form.
3. Reference the *consuming hook's* return type directly via TS
   inference: `NonNullable<ReturnType<typeof useCustomer>['data']>`.

Path 3 turned out to be the cleanest:

```ts
// Emitted output
export const editCustomerFormValuesFrom = (
  dto: NonNullable<ReturnType<typeof useCustomer>['data']>
): EditCustomerFormValues => ({ … })
```

The generator dispatches the GET sibling to `TanstackQuery` via
`insertOperation(...)` to register the hook + its import, then writes
the type expression as a string. TypeScript resolves the actual DTO
type at consume time.

**Why it matters:** This is a general pattern for "generator B needs a
type that generator A is already emitting." Two ways to couple:

- **By name**: generator B looks up A's emitted type identifier and
  references it directly (`type Dto = CustomerCustomerDto`). Tight
  coupling — B has to know A's naming convention or rely on a static
  exchange protocol.
- **By inference**: generator B references A's *exported value* and
  uses TS type operators (`ReturnType`, `Parameters`, `Awaited`,
  `keyof`, indexed access) to derive the type it needs. Loose
  coupling — when A's emitted shape evolves, B follows automatically.

The inference path also keeps generators decoupled from each other's
internal naming choices. Worth treating as the **default** for
cross-generator type consumption.

**Possible fixes:** unresolved — could be a `skmtc-generator` skill
note ("prefer TS inference over identifier lookup when consuming
another generator's emitted types"), or core could grow helpers that
emit common inference patterns.

**Version anchor:** `@skmtc/core@^0.3.x`, custom
`gen-shadcn-form` + `gen-tanstack-query-fieldplan`

**Status:** verified-fixed 2026-05-13 — pattern codified in `concepts/cross-generator-coordination.md` § Type-level coupling between generators, framed mechanically as "two different problems, not a trade-off": **by identifier** is for *name-string interpolation* into emitted text; **by TS inference** is for *deriving a TypeScript type at the consumer app's compile time*. Both still require the producer's value to be wired via `insertOperation`. Mirrored as an operational-principle row in `llms.md`.

---

### 2. Method-aware emission via single Projection branching [win]

For PATCH mode, the public `<FormName>` component is the Gate (with
query/loading/mapping); for POST/PUT it's the existing simple
wrapper. I considered two structures:

- **Two Projections**: `ShadcnForm` (POST/PUT) + new `ShadcnFormGate`
  (PATCH). Each owns its own `toIdentifier`. Risk of cache-key
  collision if both want `<FormName>`; resolved by having one own a
  different suffix, which leaks "Gate" into the public name.
- **Single Projection with branching**: `ShadcnForm.toIdentifier`
  stays `<FormName>` regardless of method; constructor and `toString`
  branch on `operation.method`. PATCH-mode constructor dispatches the
  Shell + mapper + GET hook; POST/PUT constructor dispatches the
  body + hook chain directly.

The single-Projection branch worked clean:

```ts
override toString(): string {
  return this.isPatchGate ? this.toGateString() : this.toCreateString()
}
```

**Why it matters:** Cache key is `(identifier.name, exportPath)`.
Keeping `toIdentifier` stable across method branches means the cache
key remains the same regardless of variant, and there's no risk that
two Projections both claim `<FormName>`. The "method" is internal
state of *which body to render*, not of *which identifier to occupy*.

This generalises: when a Projection's output shape varies by some
property of the operation (method, presence of a sibling, an
enrichment flag) but the *external name* stays the same, keep it in
one Projection with a branch. Introduce a second Projection only when
the external name needs to differ.

**Possible fixes:** unresolved — could be a `skmtc-generator` skill
note ("when output varies but identifier stays the same, branch
inside toString; when identifier varies, use separate Projections").

**Version anchor:** `@skmtc/core@^0.3.x`, custom `gen-shadcn-form`

**Status:** open — single-generator observation (N=1 by friction-log methodology). The pattern is real but generalizing "vary toString when external name stays the same; new Projection when name varies" to a doc-level rule from one design choice is speculative. Deferred until a second generator exhibits the same pattern; then consider as content for `extending/recipes/` or `concepts/projections-and-snippets.md` § When to use which.

---

### 3. Inline per-field emission beats runtime helper for known field sets [win]

PATCH-mode submit needs to build a body from dirty fields, with `''
→ null` translation for nullable strings. I initially reached for a
runtime helper:

```ts
// In a consumer-side helper
export const pickDirtyBody = <T extends Record<string, unknown>>(
  values: T,
  dirty: Partial<Record<keyof T, unknown>>,
  nullableStringKeys: ReadonlyArray<keyof T>
): Partial<T> => { /* iterate keys, branch */ }
```

That hit the `as` problem: `Object.keys(values)` returns `string[]`
not `Array<keyof T>`, and writing `result[key] = null` for a `keyof
T` whose declared type might not include null required a coercion.
Two `as` casts to make it compile, neither of them genuinely "type
unsafe" but both adding type-erasure noise.

The user's "no `as` without permission" rule forced a rethink. I
switched to per-field inline emission in the generator:

```ts
// Emitted output for PATCH mode
const dirty = form.formState.dirtyFields
const body: EditCustomerFormInput = {}
if (dirty.firstName) body.firstName = values.firstName
if (dirty.email) body.email = values.email === '' ? null : values.email
// …
```

Each line is type-safe at point of write — `body.email` is `string |
null | undefined`, `values.email` is `string`, the conditional yields
`string | null`. No erasure, no `as`.

**Why it matters:** Code generators have a *power consumer code
doesn't*: the field set is known at generate time, so loops over an
arbitrary keyof T can become unrolled assignments. Whenever a
runtime helper needs reflection (`Object.keys`, `Object.entries`,
index access) to do its job, the generator-side equivalent can do
the same work at emit time with full per-field type information.

The lesson generalises: if a runtime helper needs `as` to satisfy
the type checker because of `keyof T`-iteration limits, consider
moving the work to emit time. The output is more verbose but
strictly more type-safe.

**Possible fixes:** unresolved — could become a `skmtc-generator`
skill note ("prefer per-field inline emission over runtime helpers
when the field set is known at generate time").

**Version anchor:** `@skmtc/core@^0.3.x`, custom `gen-shadcn-form`

**Status:** open — the principle ties to the no-`as` rule that's already in the skill (production code narrows; `as` is reserved for tests), but the *positive* guidance ("when the field set is known at generate time, unroll the loop into per-field statements") isn't codified. Doc-cure pending in `skmtc-generator` SKILL §4 or §8.

---

### 4. Cross-form refinement signature coupling [friction]

The `emailOrPhoneRequired` named refinement (consumer-side, registered
via the `form.refinements[]` enrichment) was originally typed against
`CreateCustomerFormValues`:

```ts
// Before
import type { CreateCustomerFormValues } from '@/components/forms/CreateCustomerForm.generated'
export const emailOrPhoneRequired = (data: CreateCustomerFormValues, ctx: RefinementCtx) => {
  const hasEmail = Boolean(data.email.trim())
  // …
}
```

When the sibling `EditCustomerForm` was generated with the same
refinement enrichment, types broke: edit's `email: string | null`
isn't assignable to create's `email: string`. The form-values type
is `Required<Pick<FormInput, keys>>`, so any nullability difference
in the underlying body schema propagates.

The fix was to type the refinement against a *structural shape* that
both forms satisfy:

```ts
// After
type EmailPhoneShape = { email: string | null; phone: string | null }
export const emailOrPhoneRequired = (data: EmailPhoneShape, ctx: RefinementCtx) => {
  const hasEmail = Boolean(data.email?.trim())
  // …
}
```

**Why it matters:** The `skmtc-generator` skill rightly recommends
that named refinements import their form's `<FormName>Values` type
so TS catches drift between the form's Pick set and the refinement's
field access. That advice is sound *within a single form*. For
refinements that span multiple forms (a common case — the same
"email-or-phone-required" rule applies to both create and edit
customers), the form-values-type coupling becomes a liability: the
two forms differ in nullability, so the refinement signature has to
widen.

The structural-shape pattern is the safer default for **shared**
refinements. The form-values-type pattern remains right for
**form-specific** ones.

The friction is in the *guidance default*. The skill's example
implies form-values-typing is universal; in practice the refinement
should be typed against the narrowest shape that all consuming forms
satisfy.

**Possible fixes:** unresolved — could be a `skmtc-generator` skill
clarification ("structural shapes for shared refinements,
form-values type for form-specific ones"). Could also be addressed
in the `gen-shadcn-form` enrichment docs.

**Version anchor:** `@skmtc/core@^0.3.x`, custom `gen-shadcn-form`

**Status:** open — verified during the verify-against-source pass: the claim in the entry that *"the `skmtc-generator` skill rightly recommends that named refinements import their form's `<FormName>Values` type"* is **not substantiated** — the skill does not contain refinement guidance at all (`grep "refinement" SKILL.md` returns no hits). So the entry is asking for *new* guidance to be added, not for *existing* guidance to be clarified. Deferred: writing prescriptive new guidance from one anecdote, where the premise about the skill's existing content turned out wrong, is too speculative. If a second observation confirms the structural-shape-for-shared / form-values-type-for-form-specific pattern, consider stock-generator-specific docs in `reference/stock-generators/gen-shadcn-form.md` rather than skill-level guidance.

---

### 5. `context.document.value.operations.find` is the canonical sibling-discovery primitive [win]

PATCH Gate emission needs to know whether a GET sibling exists at the
same path (so it can dispatch the right query hook for hydration).
First impulse: ask if SKMTC core exposes a helper for this.

It doesn't, but the primitive is there: `context.document.value` is
an `OasDocument`, and `document.operations` is a flat array of all
parsed operations. So:

```ts
const findGetSibling = (operations, current) =>
  operations.find((op) => op.path === current.path && op.method === 'get')
```

is all you need. No special API. The operation-reference protocol in
the `skmtc-generator` skill uses a similar pattern (filter by tag
instead of path).

**Why it matters:** The flat `operations` array is the right
primitive — and only primitive — for cross-operation discovery. No
indexed lookup, no path map, no method-keyed structure. Filter
through the array. For document scale (a few hundred ops at most),
linear scan is fine; if it ever becomes a bottleneck, generators can
build their own index in their entry's `transform` hook.

The win is recognising that SKMTC deliberately offers one primitive
(the array) rather than a dozen specialised accessors. Means there's
nothing to look up, just `.find(predicate)`.

**Possible fixes:** unresolved — the `skmtc-generator` skill already
covers the operation-reference protocol (by tag); could be expanded
to mention "by path / method" as a closely related variant. Or it's
just an example of the LLM's tendency to over-look-for-helpers when
the array itself is the API.

**Version anchor:** `@skmtc/core@^0.3.x`

**Status:** verified-fixed 2026-05-13 — the primitive is already shown in `concepts/cross-generator-coordination.md` § Pattern: operation-reference (consumer-chosen peer) (section heading renamed today from the old "dynamic dispatch by name" framing). The example uses the same `context.document.value.operations.find(op => …)` shape the friction-log entry describes, with the by-tag filter; the framing generalizes naturally to by-path or by-method without code changes. Skill `§3.5` mirrors it. No new content needed — the primitive is the array and the doc already says so.
