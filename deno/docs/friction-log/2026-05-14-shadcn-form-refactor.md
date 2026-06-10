# 2026-05-14 — gen-shadcn-form architectural refactor

Multi-cycle refactor of `@skmtc/gen-shadcn-form` covering the enrichment
schema (`id`+`includesValues` → unified `path: string[]`), the
schema-type-default dispatch (collapsed `TextField`/`NumberField`/
`SwitchField` Snippets into a `Field` snippet driven by `conventions.ts`
defaults), submit-handler extraction into `CreateSubmitBlock` /
`PatchSubmitBlock` Snippets, form-chrome unification (`ShadcnFormCreate`
+ `ShadcnFormShell` merged into one `ShadcnFormShell` Projection),
removal of the `ShadcnForm` orchestrator Projection (variant routing
moved into `mod.ts transform`), and several smaller idiom cleanups.

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `OasSchema.resolve()` self-returns on non-refs; `isRef() ? resolve() : schema` ternary is redundant | polish | open |
| 2 | Projection-that-can't-be-Driver-dispatched is a silent foot-gun | friction | open |
| 3 | `toIdentifier` is only consulted when Driver-dispatched — `new`-only instances bypass it | win | open |
| 4 | Variant dispatch belongs in entry `transform`, not in an orchestrator Projection | win | open |
| 5 | Pure-function helpers (`resolveBody`, `validateAllowList`) get re-called per Projection; the "self-contained Projection" doctrine doesn't suggest memoization | friction | open |
| 6 | Discriminated `fieldConfig` for single vs compound was overcomplicated — same enrichments apply to both | friction | open |
| 7 | `decideFormVariant` as a single pure source of truth for *both* dispatch and `toIdentifier` keeps the two in lock-step | win | open |
| 8 | Snippet→Projection demotion cleans up `register`/`insertOperation` call sites | win | open |
| 9 | One-operation-to-many-forms is not expressible — `toIdentifier`'s 1:1 purity blocks per-section PATCH forms | blocker | **resolved** — operation-variant axis landed in `@skmtc/core@0.5.0`; see [`concepts/variants.md`](../concepts/variants.md) |

---

### 1. `OasSchema.resolve()` self-returns on non-refs; `isRef() ? resolve() : schema` ternary is redundant [polish]

Multiple Projections in this generator had the idiom:

```ts
const resolved = schema.isRef() ? schema.resolve() : schema
```

**What happened:** The user pointed out this is redundant — `OasRef.resolve()` follows the ref, and the other `OasSchema` variants (`OasObject`, `OasString`, etc.) implement `.resolve()` to return `this`. So `schema.resolve()` works uniformly for the whole union. I'd written the ternary as a defensive idiom across `FormValuesFrom`, `ShadcnFormHook`, `FormEmptyValues`, and `helpers/emptyValue.ts` — the pattern propagated by copy-paste once it appeared in the first file.

**What was expected:** that `.resolve()` was only defined on `OasRef` (which would have made the ternary load-bearing). I had `.isRef()` narrowing reflexively because it's how I'd reach for the type discriminator.

**Why it matters:** the `.resolve()` method on the schema union is the SKMTC equivalent of a no-op-on-non-refs union method — exactly the kind of duck-typed sibling-method pattern the union *encourages* (per the skill's "OasSchema is a union of siblings, not a class hierarchy" principle). The ternary pattern obscures that uniformity. Worse, once one Projection has it, peers copying the pattern make the redundancy ambient. This is the asymmetric-cost-of-cleanup case: each instance is one line, but the *suggestion to readers* is that `.resolve()` doesn't work on the union.

**Possible fixes:** unresolved — the `skmtc-generator` skill's "narrow before accessing" rule could carve out `.resolve()` as a safe-on-the-whole-union method (similar to how `.toString()` is safe on the whole `Stringable` union). Or `@skmtc/core` could document this self-returning behavior in the `OasSchema.resolve()` signature where future agents will see it.

**Version anchor:** `@skmtc/core@0.4.5`

**Status:** open

---

### 2. Projection-that-can't-be-Driver-dispatched is a silent foot-gun [friction]

`ShadcnFormDefaultsGate` extended `ShadcnFormBase` (a Projection base via `toOasOperationProjectionBase`) but defined a non-standard constructor:

```ts
export type ShadcnFormDefaultsGateArgs = OasOperationProjectionConstructorArgs<EnrichmentSchema> & {
  defaultsHook: ModuleRef
}

constructor({ context, operation, settings, defaultsHook }: ShadcnFormDefaultsGateArgs) { ... }
```

**What happened:** The class was only ever `new`'d directly by `ShadcnForm` (the orchestrator), never dispatched via `insertOperation`. The orchestrator extracted `defaultsHook` from the variant data and threaded it through. But the class was *typed* as a Projection — anyone reading the file would assume it's dispatchable. If a future generator (or even our own code) called `context.insertOperation({projection: ShadcnFormDefaultsGate, operation})`, the Driver would pass the standard `{context, operation, settings}` without `defaultsHook`, and the destructure would crash at runtime. Compounding: the inherited `toIdentifier` returns the bare form name, which would collide with `ShadcnForm`'s registered Definition under the same key.

The user spotted this directly: *"its a projection, but we use it only for its value. Also, it would break if it was used as a projection via a driver since it would not receive a `defaultsHook`."*

**What was expected:** that the type system would surface the contract violation. It doesn't — `OasOperationProjectionConstructorArgs<E>` is the *minimum* shape the Driver passes; the class can ask for more and the type-checker doesn't object. Only when `insertOperation` tries to invoke the constructor does the contract assert itself, and that's runtime.

**Why it matters:** "Projection that can't actually be dispatched" is a class of latent issue the skill doesn't flag. The fix (read `defaultsHook` from `settings.enrichments` with an `invariant`, drop the custom args type) is what `ShadcnFormPatchGate` was already doing after the earlier `getSibling` cleanup — but the pattern wasn't surfaced as "always use the standard ConstructorArgs even for `new`-only Projections, or convert to a Snippet". The `ShadcnFormBase`-derived convenience methods (`this.insertOperation`, `this.register` without explicit `destinationPath`) make extending the base attractive even when the class is never dispatched, which is the seed of this anti-pattern.

**Possible fixes:** unresolved — the `toOasOperationProjectionBase` factory could expose a `requires: 'driver-only' | 'inline-only' | 'either'` flag that constrains the constructor shape. Or the skill could codify "Projection's constructor args must equal `OasOperationProjectionConstructorArgs<E>`; if you need more data, convert to a Snippet or read from `settings.enrichments` with an `invariant`."

**Version anchor:** `@skmtc/core@0.4.5`, `@skmtc/gen-shadcn-form@0.0.55`

**Status:** open

---

### 3. `toIdentifier` is only consulted when Driver-dispatched — `new`-only instances bypass it [win]

Refactoring the chrome Projection to play two roles — inline content (create variant) and registered Definition (gate variants).

**What happened:** I initially expected `static toIdentifier` to always fire when a Projection was instantiated — making "one class, two cache keys" feel impossible. After several rounds with the user, the actual mechanic became clear: `toIdentifier` is *only* called by the Driver when computing a cache key, which happens *only* during `insertOperation`/`insertNormalizedModel` dispatch. A class that's `new`'d directly never triggers it — `super(args)` just inherits the parent's settings (whatever identifier the caller already had). This enables a single Projection class to act as either: (a) inline content embedded via `${delegate.toString()}` with the caller's identifier, or (b) a registered Definition under its own `toIdentifier`-computed cache key.

**Why it matters:** this is the load-bearing mechanic for the final architecture — `mod.ts transform` dispatches `ShadcnFormShell` via `insertOperation` for the `create` variant (registers under the bare form name), and the Gate Projections dispatch `ShadcnFormShell` again for their `${name}Shell` inner component. Same class, two different cache keys, distinguished purely by what `decideFormVariant` returns. The "static method bypassed when `new`'d directly" rule isn't anywhere in the SKMTC skills — it's implicit in the Driver's dispatch flow. Once grasped, it unlocks the "one class, variable identifier" pattern; without it, generators tend to grow class-per-role (which is what `ShadcnFormCreate` + `ShadcnFormShell` originally were, before the merge).

**Possible fixes:** unresolved — likely a candidate for the `skmtc-generator` skill's "DSL: Projection vs Snippet" section. A sentence like "`toIdentifier` is only consulted when the Projection is Driver-dispatched (via `insertOperation`/`insertNormalizedModel`); directly-constructed instances inherit the caller's `settings`" would make the mechanic explicit.

**Version anchor:** `@skmtc/core@0.4.5`

**Status:** open

---

### 4. Variant dispatch belongs in entry `transform`, not in an orchestrator Projection [win]

Initial architecture had `ShadcnForm` as a top-level Projection that called `decideFormVariant` in its constructor and instantiated one of three delegate Projections (`ShadcnFormCreate`, `ShadcnFormPatchGate`, `ShadcnFormDefaultsGate`), forwarding `toString()` to the chosen delegate.

**What happened:** Over the session this orchestrator collected friction:

1. `ShadcnFormCreate` became a degenerate wrapper (just embedded `FormChromeSnippet.toString()`) once chrome was extracted.
2. `ShadcnFormDefaultsGate` needed `defaultsHook` threaded through custom constructor args (see #2) because the orchestrator was extracting it from the variant.
3. The orchestrator's `delegate` field held "Projections that aren't really meant to be Projections" — Driver-dispatch would have crashed.

The user's suggestion: *"Get rid of `ShadcnForm` and move its constructor contents into transform call of `ShadcnFormEntry` where we can insert correct projection based on discriminator."* Implementation:

```ts
transform({ context, operation }) {
  const enrichments = ShadcnFormBase.toEnrichments({ operation, context })
  match(decideFormVariant({ operation, enrichments }))
    .with({ kind: 'patchGate' }, () => context.insertOperation({ projection: ShadcnFormPatchGate, operation }))
    .with({ kind: 'defaultsGate' }, () => context.insertOperation({ projection: ShadcnFormDefaultsGate, operation }))
    .with({ kind: 'create' }, () => context.insertOperation({ projection: ShadcnFormShell, operation }))
    .exhaustive()
}
```

**Why it matters:** the entry's `transform` is the natural home for "which Projection emits for this operation" decisions. Pushing that decision into a Projection's constructor means the chosen variant has to thread back through delegate-toString forwarding, with all sub-Projections inheriting the orchestrator's settings (bare name). It's a recurring temptation — "the variant is a property of the *form*, so it lives on the form Projection" — but it conflates entry-level routing with Projection-level emission. With dispatch in `transform`, each Projection has a single clear role: it knows it's being dispatched, it owns its own identifier, the Driver-dispatch contract holds, and `decideFormVariant` becomes the shared source of truth callable from both `transform` (to pick the Projection) AND from `ShadcnFormShell.toIdentifier` (to pick the cache key) — see #7.

**Possible fixes:** unresolved — could be codified in `skmtc-generator` as a pattern: "variant routing for an operation belongs in entry-level `transform`, not in an orchestrator Projection. Use a discriminated `decideVariant({operation, enrichments})` function as the shared source of truth between the entry and any variant-aware static methods on Projections."

**Version anchor:** `@skmtc/core@0.4.5`

**Status:** open

---

### 5. Pure-function helpers (`resolveBody`, `validateAllowList`) get re-called per Projection; the "self-contained Projection" doctrine doesn't suggest memoization [friction]

The generator has 5 Projections (`FormBody`, `FormValuesType`, `FormEmptyValues`, `ShadcnFormHook`, `FormValuesFrom`) that each independently call `resolveBody(operation)` and 4 that call `validateAllowList(...)`. The skill's "self-contained Projection" doctrine encourages this: each Projection re-derives its own state rather than receiving it from a parent, so it can be reached by other generators via `insertOperation` without bookkeeping.

**What happened:** The code comments in this generator explicitly call out the redundancy as acceptable: *"the duplicate work with `ShadcnFormHook` is cache-idempotent"* (`FormBody.ts`) and *"same call happens in `ShadcnForm` and in `FormEmptyValues`; pure-function duplication, no side effects"* (`ShadcnFormHook.ts`). Both are technically correct — the duplication is *semantically* idempotent (same inputs → same outputs, no side effects) — but the framing papers over real CPU cost: for 273 generated forms × 4 redundant walks each, that's ~1000 pointless schema/row iterations per `skmtc generate` run.

**What was expected:** that "cache-idempotent" implied something the Driver was doing. It doesn't. The Driver's cache covers `insertOperation`/`insertNormalizedModel` (Projection dispatch), not arbitrary pure helpers. Plain function calls are not cached.

**Why it matters:** the `cache-idempotent` framing in code comments is misleading-by-default. A reader assumes the Driver handles it (because cross-Projection dispatch *is* Driver-cached) and stops thinking about it. The actual fix — a module-scope `WeakMap<OasOperation, AllowList>` memo — is trivial but invisible because the doctrine doesn't prompt it. The "pure functions can be safely re-invoked" rule (true semantically) is shielding a real performance cost from review.

**Possible fixes:** unresolved — could be a pattern in `skmtc-generator`: "pure helpers that walk the operation/schema in multiple Projections should memoize via `WeakMap<OasOperation, T>` at module scope. The Driver's cache covers cross-Projection dispatch, not plain function calls — duplication is correctness-safe but not free."

**Version anchor:** `@skmtc/core@0.4.5`, `@skmtc/gen-shadcn-form@0.0.55`

**Status:** open

---

### 6. Discriminated `fieldConfig` for single vs compound was overcomplicated — same enrichments apply to both [friction]

Designing the schema for compound fields (a single component reading multiple body keys via the parent lens, like `TaxableField` writing both `isTaxable` and `taxRate`).

**What happened:** I initially proposed a discriminated union:

```ts
const singleFieldConfig = v.object({
  path: v.pipe(v.array(v.string()), v.length(1)),
  label, placeholder, description, defaultValue, ...
})

const compoundFieldConfig = v.object({
  path: v.pipe(v.array(v.string()), v.minLength(2)),
  component: componentRef,  // required
  visibleWhen, collapsible, colSpan
})

const fieldConfig = v.union([singleFieldConfig, compoundFieldConfig])
```

The reasoning was "compound entries don't have meaningful `label`/`placeholder`/`defaultValue` — those concepts belong to a single value, not a multi-value compound." Applied this through `enrichments.ts`, `schemaToField.ts` (added a `SingleFieldConfig` narrowing guard), and `FormEmptyValues.ts` (skipped compound entries in the defaultValue loop).

The user pushed back: *"Please do not make a distinction between single field and compound field enrichments. both should have same enrichments."* And later: *"when we have a compound input, it is one canonical field, it just deals with multiple values like taxRate and isTaxable in previous case."*

**What was expected:** that "single value" vs "multi-value" was the natural axis to discriminate on, and per-value enrichments only made sense in the single-value case.

**Why it matters:** the user's framing inverted the axis I was reaching for. A compound is *still one canonical field* from the form-config perspective — it just happens to read/write multiple body keys via a parent lens. The same enrichments (label, placeholder, etc.) are meaningful for both; whether the underlying component *uses* them is a property of the component, not of the field-config schema. By forcing a discriminated union, I'd front-loaded a generator-internal split that the user didn't have in their mental model. The enrichment schema is the *user-facing* contract; it should match the user's mental model of "this is one field," not the generator's mental model of "this is one-vs-many body keys."

The hint was right there in the existing TaxableField component:

```ts
type TaxableShape = { isTaxable: boolean; taxRate?: number }
export type TaxableFieldProps<T extends TaxableShape> = { lens: Lens<T> }
```

RHF lenses already treat the compound as one lens over a shape — neither key is "primary." I was importing a generator-side discrimination that the runtime didn't have.

**Possible fixes:** unresolved — possibly a `skmtc-generator` skill note: "field-config schema design should match the user's mental model of the field, not the generator's view of how the field decomposes into body keys. When the runtime treats a compound as 'one lens over a shape', the enrichment schema should too — no discriminated union, no carve-outs for `label`/`placeholder` on multi-key entries. Filter at the consumption site, not the schema."

**Version anchor:** `@skmtc/gen-shadcn-form@0.0.55`

**Status:** open

---

### 7. `decideFormVariant` as a single pure source of truth for *both* dispatch and `toIdentifier` keeps the two in lock-step [win]

After eliminating the `ShadcnForm` orchestrator (see #4), the variant decision needed to be made in two places:

1. `mod.ts transform` — to pick which top-level Projection to dispatch.
2. `ShadcnFormShell.toIdentifier` — to decide whether to register at the bare name (create variant) or `${name}Shell` (gate variants).

**What happened:** `decideFormVariant` is pure of `context` — it only reads `(operation, enrichments)`. That makes it callable from both `transform` (which has `context` and can extract enrichments) AND from `toIdentifier` (a static method receiving `{operation, enrichments}` directly). As long as both call sites give the same inputs, they get the same answer, and the cache-key invariant holds: the entry's `transform` dispatches `ShadcnFormShell` for create operations → `toIdentifier` returns the bare name → Definition registered there. The Gate Projections dispatch `ShadcnFormShell` for their inner component → `toIdentifier` returns `${name}Shell` → Definition registered there. The two coexist in the same file without colliding.

**Why it matters:** the alternative — branching identifier in `toIdentifier` via some other signal (a constructor flag, an enrichment field, the call-site identity) — was both impossible (statics can't read instance state) and brittle (would require side-channel information). Using a *pure variant function as the shared decision* threads cleanly through the static-method constraint: both consumers compute the same variant from the same inputs, so the routing decision and the cache-key decision are inherently consistent.

This is a Driver-mechanics + variant-decision compound pattern. Worth preserving and possibly codifying: when a Projection's `toIdentifier` needs to depend on *which variant of the operation we're emitting*, a context-free `decideVariant({operation, enrichments})` function is the bridge.

**Possible fixes:** unresolved — candidate for codification in `skmtc-generator` alongside #4 (variant dispatch belongs in `transform`). The two patterns work together: keep `decideVariant` pure-of-context so it's reusable from both `transform` and static `toIdentifier`.

**Version anchor:** `@skmtc/core@0.4.5`, `@skmtc/gen-shadcn-form@0.0.55`

**Status:** open

---

### 8. Snippet→Projection demotion cleans up `register`/`insertOperation` call sites [win]

Mid-refactor, `FormChromeSnippet` was a Snippet wrapped by two Projection classes (`ShadcnFormCreate` and `ShadcnFormShell`). When the two Projections merged into one (`ShadcnFormShell`), the wrapping Projection had only one caller, and the Snippet's purpose ("shared between two Projections") evaporated.

**What happened:** Folded `FormChromeSnippet` back into `ShadcnFormShell`. In the process the call sites simplified:

| | Snippet form | Projection form |
|---|---|---|
| Dispatch | `context.insertOperation({projection, operation, destinationPath})` | `this.insertOperation(Projection, operation)` |
| Register imports | `this.register({imports, destinationPath})` | `this.register({imports})` |

The Projection wrapper's `this.insertOperation` auto-fills `destinationPath` from `this.settings.exportPath`; `this.register` does the same. Each call line shrunk by a property. Net result: ~110 lines in one class vs ~50 + ~84 across two files, but each line is simpler.

**Why it matters:** "extract to Snippet for reuse" is a real pattern, but the converse — "fold back when reuse evaporates" — is also useful and isn't usually framed as a refactoring move. The Projection-side helpers (`this.insertOperation` auto-fills, `this.register` auto-fills) are tighter than the Snippet-side equivalents (`context.insertOperation({...})` with explicit `destinationPath`). When a Snippet has exactly one caller and that caller is a Projection, folding back is a net win in call-site clarity.

This is the dual of "when to extract a Snippet" — *when to demote*. Worth surfacing in the skill alongside the extraction guidance: "If a Snippet has exactly one Projection caller and no cross-generator reach, fold its body into the Projection's `toString()` and migrate `context.insertOperation({...})` → `this.insertOperation(...)`."

**Possible fixes:** unresolved — likely a one-paragraph addition to the `skmtc-generator` skill's "Projection vs Snippet" section. The current skill text covers extraction; the demotion direction would balance it.

**Version anchor:** `@skmtc/core@0.4.5`, `@skmtc/gen-shadcn-form@0.0.55`

**Status:** open

---

### 9. One-operation-to-many-forms is not expressible — `toIdentifier`'s 1:1 purity blocks per-section PATCH forms [blocker]

> **Status: resolved.** Landed in `@skmtc/core@0.5.0` as the
> operation-variant axis. The "Variants map at the enrichment
> level" architectural option below (option A) was implemented, but
> the variant level lives in core rather than in
> `gen-shadcn-form`'s enrichment schema — generator-side schemas
> stay unchanged and core wraps the variant axis around them.
> `gen-shadcn-form` consumed the new API in the same release and
> is the first variants-aware generator. See
> [`concepts/variants.md`](../concepts/variants.md) for the
> canonical reference and
> `core/context/GenerateContext.variants.test.ts` +
> `core/context/GenerateContext.cross-variant.test.ts` for the
> tests that pin the invariants.


Surfaced while migrating FieldPlan's quote-edit pages to generated forms. Several distinct UI pages each edit a different field-subset of the *same* PATCH endpoint — and `gen-shadcn-form` can't produce more than one Definition per `(operation, method)`.

**What happened:** `PATCH /v2/quoting/quotes/{quoteId}` accepts 11 fields (`title`, `description`, `customerId`, `locationId`, `validUntil`, `validDays`, `discountType`, `discountValue`, `terms`, `notes`, `internalNotes`). The product splits editing across at least **five** section-edit pages, each rendering 1–2 of those fields:

| Route | Renders |
|---|---|
| `/quotes/:id/validity/edit` | `validDays` |
| `/quotes/:id/description/edit` | `description` |
| `/create/quotes/:id/quote-type` | `quoteType` |
| `/create/quotes/:id/request-description` | `description` + `title` (with a "generate title" checkbox) |
| `/create/quotes/:id/review` | `validDays` + `notes` |

All five call the same PATCH endpoint. The current SKMTC enrichment schema has one slot per `(path, method)`:

```jsonc
"/v2/quoting/quotes/{quoteId}": { "patch": { ...one form's config... } }
```

So `client.json` can express *one* form — currently set to render only `description` for `EditQuoteForm`. The remaining four pages have to stay hand-coded.

**What was expected:** SKMTC's "one form per operation" was the natural starting point — and for POST endpoints (where the body schema usually matches the form 1:1) it's correct. PATCH endpoints, especially ones with broad multi-field bodies, are different. The UI's natural decomposition is per-section, not per-operation.

**Why it matters:** This is the single biggest blocker to further wizard-and-section-edit migration in the FieldPlan app. The same pattern applies to other broad PATCH endpoints — `PATCH /v2/jobs/{id}`, `PATCH /v2/customers/{customerId}` (already in use; only renders 4 of N fields), `PATCH /v2/dispatch/route-plans/{id}`, etc. Roughly 5–8 hand-coded section-edit forms in this codebase remain hand-coded purely because of this gap.

The 1:1 assumption is baked into multiple layers:

1. **Enrichment schema** — `formSchema` is one config per `(path, method)`. No way to enumerate variants.
2. **`toIdentifier({operation, enrichments})`** — pure static method, returns one name from one input. Even if the schema had a variants map, the Driver's `insertOperation(P, op)` would cache the result under one key.
3. **`mod.ts transform`** — calls `insertOperation` once per operation. The Driver dedups same-key dispatches; calling twice from one `transform` yields one Definition.

**Two architectural options for fixing:**

**A. Variants map at the enrichment level (recommended).** Add a `variants` block to the form enrichment schema:

```jsonc
"/v2/quoting/quotes/{quoteId}": {
  "patch": {
    "variants": {
      "Description": { "submitLabel": "Save", "rows": [[{ "path": ["description"] }]] },
      "Validity":    { "submitLabel": "Save", "rows": [[{ "path": ["validDays"] }]] },
      "QuoteType":   { "submitLabel": "Save", "rows": [[{ "path": ["quoteType"] }]] }
    }
  }
}
```

Each variant produces a separately-named Definition (`EditQuoteDescriptionForm`, `EditQuoteValidityForm`, `EditQuoteTypeForm`) with its own `EMPTY_VALUES`, Zod `.pick`, dirty-only PATCH submit. The implementation needs to bypass the Driver's standard `insertOperation` (which is 1:1 keyed) and use `context.defineAndRegister({identifier, value, destinationPath})` — the same pattern documented in the skill for accumulator-style generators (see [`gen-msw` example in `skmtc-generator` skill §10 "Accumulator-style generator"](../../skills/skmtc-generator/SKILL.md)). The entry's `transform` iterates the variants map and calls `defineAndRegister` per variant.

Sibling Definitions per variant: `Hook`, `Body`, `ValuesType`, `EmptyValues`, `PropsType`, `StateType`, `OptionsType` all need variant-bound flavours since each variant has a different field subset → different types → different empty values → different `.pick` etc. The Shell-variant identifier branching (currently driven by `decideFormVariant`) extends to also branch on variant-name.

**B. Per-section virtual paths (hack).** Allow consumers to append `#variantName` to the path key in `client.json`:

```jsonc
"/v2/quoting/quotes/{quoteId}#description": { "patch": {...} },
"/v2/quoting/quotes/{quoteId}#validity":    { "patch": {...} }
```

The generator strips `#suffix` to find the OpenAPI op but uses the full string as the cache-key prefix. Tiny generator change (one path-resolution helper) but the path key is now misleading.

**Possible fixes:** unresolved — most likely option A (variants map + `defineAndRegister` per variant). The implementation effort is real (touches enrichments, mod.ts transform, all ~10 per-form Projections that currently take `OasOperationProjectionConstructorArgs` and now need variant context), but the payoff unlocks ~5–8 hand-coded forms across FieldPlan today and future-proofs the pattern for any operation whose UI naturally splits into per-section editors.

A second concern worth flagging during implementation: the `defaultsHook` enrichment is currently form-level. For variants, each variant could need its own `defaultsHook` (different fields → different defaults source) — the variant block should carry it.

Cross-references in this same session that constrain the design space:
- [[3]] — `toIdentifier` only consulted when Driver-dispatched. `defineAndRegister` bypasses the Driver's cache-key path, which is exactly what variants need.
- [[7]] — `decideFormVariant` as shared pure source of truth between transform and toIdentifier. With variants, that decision becomes a per-variant computation (each variant could be create/patchGate/defaultsGate independently).

**Version anchor:** `@skmtc/core@0.4.5`, `@skmtc/gen-shadcn-form@0.0.55`

**Status:** open — flagged for follow-up implementation by another agent.
