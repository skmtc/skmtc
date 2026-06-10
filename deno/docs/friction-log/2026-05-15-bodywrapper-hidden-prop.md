# 2026-05-15 — bodyWrapper / hidden fields / synthesized.prop

Extended `@skmtc/gen-shadcn-form` with three new compositional primitives — `bodyWrapper` (a wrapper component placed around the body inside `<form>`), `hidden: true` on `fieldConfig` (field participates in form state but renders no input), and a third `synthesized` variant `{ id, prop: true }` (body value supplied by a required prop on the form's options) — to migrate the hand-coded `CreateLocationForm` (interactive map + geocoding + lat/lng + customerId) onto the generator. End-to-end verified in the canvas mock; hand-coded form + payload builder deleted.

## Knowledge acquired

Working in a cloned `gen-shadcn-form` and adjacent CLI/canvas tooling.

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `skmtc generate <project>` does not auto-rebundle — it runs against whatever `bundle.js` already exists on disk. Mtime check on `bundle.js` vs source files is the reliable way to know if changes are reflected. `skmtc dev` watches and rebuilds; `skmtc bundle` + `skmtc generate` are independent steps. | `skmtc-cli` skill: add an explicit "bundle freshness is not automatic" note next to `bundle`/`generate` |
| K2 | `skmtc bundle <project>` errored with `bundle.js was expected at <path> but wasn't written` even when the underlying `deno bundle --output bundle.js worker.ts` ran cleanly in the same directory. The CLI looks for the output at a path that diverges from where Deno actually writes it. Workaround: invoke `deno bundle` directly. | `skmtc-cli` issue: investigate path-resolution divergence; consider raising in `skmtc-debug` recipe |
| K3 | Local canvas tooling has two distinct ports for the same app: `pnpm dev:mock` runs `vite --mode mock` with HMR (port 5179 when explicitly started that way), while `pnpm preview:mock` runs `vite build --mode mock && vite preview --outDir dist-mock`. The latter is what was actually running on 5179 — preview serves a built bundle, no HMR. Mock-server state lives in the preview process's memory and resets when `pnpm build:mock` triggers a preview restart (the parent `sh -c` chain replaces the running `vite preview` child). | Consumer-project docs concern (FieldPlan), not SKMTC; but a generic "test loop assumes HMR — check what your preview command actually runs" note is broadly useful |
| K4 | For POST endpoints, `ShadcnFormShell` *is* the public form Projection (variant `'create'` per `decideFormVariant`); the bare form name without `Shell` suffix). For patchGate / defaultsGate variants, Shell is the inner component wrapped by a Gate that owns the bare name. Means changes to Shell's emission (like adding `bodyWrapper`) automatically apply to both the create-public-form case AND the patchGate-inner-shell case. | Already implicit in `ShadcnFormShell.ts` comments; one-line note in skill explaining "Shell emission applies to both create-public and gate-inner forms" would help |
| K5 | TypeScript's `Required<T>` removes the `?` *modifier* but does NOT remove `\| undefined` from the *value type*. For `{x?: T}` (where the modifier is the only carrier of optionality), `Required<>` yields `{x: T}` — `undefined` is no longer assignable. To keep `undefined` assignable while picking fields, use plain `Pick<T, K>` (preserves the source's `?`). The generator's `FormValuesType` therefore needs `Required<Pick<>> & Pick<>` when mixing required and optional-by-modifier fields in one type. | `skmtc-generator` skill: add to the TS-emission section as a "modifier vs union" gotcha |
| K6 | Adding a required option to the form hook means the generator must drop the `(options = {})` default from the hook signature — otherwise the empty default doesn't satisfy the option type. A new flag (`hasRequiredOptions`) on `ShadcnFormHook` decides whether to emit ` = {}`. Generators emitting hook signatures should always check whether their options type has any required field before defaulting. | `skmtc-generator` skill: emit a note next to the `useFoo(options = {})` scaffold about conditionally dropping the default |
| K7 | `body.properties` from `resolveBody` preserves the source schema's `nullable` and `?: T` separately. The form generator's `nullableStringFieldNames` check (`schema.type === 'string' && schema.nullable === true`) detects only the former; optional-non-nullable fields like `title?: string.min(1)` don't get caught by the empty→null mapping. Each shape needs its own mapping rule. | Earlier session (2026-05-15 streamline-title-update-spec) addressed the title case by changing OAS; the general rule of "nullability vs optionality vs constraints — three different axes, three different submit-handler concerns" should land in the skill |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `skmtc bundle` path-resolution bug | blocker | open |
| 2 | `skmtc generate` silently uses stale bundle | friction | open |
| 3 | `Required<Pick<>>` loses `\| undefined` for `?`-only optionality | friction | open |
| 4 | `(options = {})` default conflicts with required-prop synthesized | friction | open |
| 5 | Mock-canvas `vite preview` chain wipes state on rebuild | friction | open |
| 6 | `bodyWrapper` + `hidden` + `synthesized {prop}` triplet for stateful body chrome | win | open |
| 7 | `Required<Pick<>> & Pick<>` split type for mixed-modifier values | win | open |
| 8 | Generator-side `nullableStringFieldNames` doesn't cover `T?` with constraints | friction | open |

---

### 1. `skmtc bundle` path-resolution bug [blocker]

Authoring three new enrichment primitives in a cloned `gen-shadcn-form` required repeated rebundles to test.

**What happened:** `skmtc bundle mobile-app` (and `skmtc bundle mobile-app --json`) failed with:

```
error: Uncaught (in promise) Error: bundle.js was expected at file:///<…>/.skmtc/mobile-app/bundle.js but wasn't written
    at bundleHeadless (file:///<…>/cli/lib/bundle-headless.ts:70:11)
```

Running `deno bundle --output bundle.js worker.ts` directly in the same `.skmtc/mobile-app/` directory succeeded and wrote `bundle.js` to the expected path:

```
⚠️  deno bundle is experimental and subject to changes
Bundled 580 modules in 243ms
  bundle.js 803.64KB
```

The CLI's expected output path and Deno's actual output path diverged, even though both were given the same target.

**What was expected:** `skmtc bundle <project>` to wrap `deno bundle` and produce the same output.

**Why it matters:** `skmtc bundle` is the recommended command from the CLI surface; falling back to raw `deno bundle` works but bypasses whatever pre/post-checks the wrapper might do (peer-pin verification, manifest hooks, etc.). For a session that does many bundle cycles — exactly what generator authoring requires — this is a steady-state blocker. Worked around by aliasing `deno bundle --output bundle.js worker.ts` in the project directory.

**Possible fixes:** unresolved — needs reflection on whether the path divergence is `deno bundle` flag drift, a working-directory assumption in `bundleHeadless`, or an env-specific override.

**Version anchor:** `@skmtc/cli` (running compiled binary `~/.deno/bin/skmtc`)

**Status:** open

---

### 2. `skmtc generate` silently uses stale bundle [friction]

Multiple cycles of "edit generator → run `skmtc generate` → inspect output" without realising the output reflected the *previous* bundle.

**What happened:** After adding (then reverting) an `optional: true` field-level enrichment, I ran `skmtc generate mobile-app --json` and saw clean output with no `.partial({...})` chains. I assumed this confirmed my revert had taken effect. The user asked: "did you rebuild ... after making changes? Should you run `skmtc dev`?" Mtime check showed:

```
bundle.js:          1778861194 (May 15 17:06)
ShadcnFormHook.ts:  1778864591 (later)
enrichments.ts:     1778864580 (later)
FormEmptyValues.ts: 1778864605 (later)
```

The bundle was older than the source. `skmtc generate` had been running against the pre-revert bundle the entire time. The output happened to be identical because my dormant emission path required `optional: true` in `client.json` — which I never set — so the gated code path was inactive either way.

**What was expected:** that `skmtc generate` would notice the source files were newer than `bundle.js` and rebuild, or at least warn.

**Why it matters:** The "tests pass, output looks right" loop is misleading when the test target is stale. For an LLM agent in particular: I had no visual mtime indicator that anything was wrong, and the output was structurally indistinguishable between "fresh bundle with reverted code" and "stale bundle with dormant code". The user's instinct ("should you run `skmtc dev`?") was the only thing that surfaced the mismatch.

The trap is deepest when generator changes are *additive enrichments gated on client.json keys*: the gate-off path is identical pre- and post-change, so stale bundles look fine. Only when the gate-on path is exercised does the staleness surface.

**Possible fixes:** unresolved — `skmtc generate` could mtime-compare source vs bundle and refuse to run on stale; `skmtc dev` could be the recommended-by-default loop; the skill could prescribe "always verify with mtime / grep before declaring generator changes effective."

**Version anchor:** `@skmtc/cli` (compiled `~/.deno/bin/skmtc`)

**Status:** open

---

### 3. `Required<Pick<>>` loses `| undefined` for `?`-only optionality [friction]

Designing the `FormValuesType` emission for forms that mix visible (required) and hidden (optional-by-modifier) fields.

**What happened:** Initial plan was to keep `Required<Pick<TsBody, allIds>>` as the single emitted type, expecting that `latitude?: number` in the body would survive `Required<>` as `latitude: number | undefined`. It does not — TypeScript's `Required<T>` is `{[K in keyof T]-?: T[K]}`, which removes only the `-?` modifier. The value type `number` (the only thing the source had, before `?` desugaring) stays `number`. Setting `EMPTY_VALUES.latitude = undefined` then becomes a type error: `Type 'undefined' is not assignable to type 'number'`.

The fix was to split the picked-fields TS emission:

```ts
// before
Required<Pick<Body, ${allIds}>>

// after
Required<Pick<Body, ${visibleNonHiddenIds}>> & Pick<Body, ${hiddenIds}>
```

The second `Pick` (without `Required`) preserves the source's `?` for hidden fields, making the value type `T | undefined` again.

**What was expected:** `Required<>` to behave like `Required<{x: T | undefined}>` — preserving the union but removing the modifier.

**Why it matters:** This is a real TypeScript gotcha that bites code generators emitting picked + required types. The `EMPTY_VALUES` shape and the `useForm<Values>` default-values type must agree; mixing required-by-render with optional-by-wrapper fields needs the split-intersection emission. The skill doesn't currently mention this — the `Required<Pick<>>` idiom is shown as monolithic in `FormValuesType.ts`'s comment block.

**Possible fixes:** unresolved — the `skmtc-generator` skill's TS-emission section could carry a note about modifier-vs-union semantics with a worked example; alternatively, a helper that returns the right intersection given visible/hidden id lists could be extracted to `@skmtc/core` so generators don't roll their own.

**Version anchor:** `@skmtc/gen-shadcn-form` (cloned in `.skmtc/mobile-app/`); `@skmtc/core@0.5.1`

**Status:** open

---

### 4. `(options = {})` default conflicts with required-prop synthesized [friction]

Adding the third `synthesized` variant `{ id, prop: true }` — declaring required-on-options body values.

**What happened:** The new variant emits a required field on the hook's options type: `customerId: NonNullable<CustomerCreateLocation['customerId']>`. The hook's emitted signature was unchanged: `(options: UseCreateLocationFormOptions = {}): CreateLocationFormState => {...}`. The empty-object default no longer satisfies the type — TS error:

```
src/components/forms/CreateLocationForm.generated.tsx(46,39): error TS2741:
Property 'customerId' is missing in type '{}' but required in type 'UseCreateLocationFormOptions'.
```

Fixed by conditionally dropping the default when any prop synthesized field exists:

```ts
const optionsDefault = this.hasRequiredOptions ? '' : ' = {}'
return `(options: ${this.optionsName}${optionsDefault}): ...`
```

**What was expected:** that the generator's existing `= {}` default would interact gracefully with optional/required-mix options types.

**Why it matters:** This is a foreseeable trap when extending the options type. The current pattern of "always emit `= {}` default" was correct under the prior assumption that all options were optional. Adding *any* required option breaks it. A future enrichment that adds another required option (e.g., `tenantId: string`, `feature flags`, …) will hit the same issue and need the same conditional.

The fix is correct but is a localized patch — what would be better is a higher-level invariant: emitting hook signatures should always inspect their options type. A helper like `optionsDefault(optionsType)` that returns `' = {}'` only when every field is optional would let the generator-author not think about it.

**Possible fixes:** unresolved — generator-side a helper, or a `@skmtc/core` utility that synthesizes the right default suffix based on a type emission's required-field list.

**Version anchor:** `@skmtc/gen-shadcn-form` (cloned); `@skmtc/core@0.5.1`

**Status:** open

---

### 5. Mock-canvas `vite preview` chain wipes state on rebuild [friction]

Testing the new enrichments against the live canvas mock preview.

**What happened:** Canvas-preview port (5179 in this project) was running `pnpm preview:mock`, which is `vite build --mode mock --outDir dist-mock --emptyOutDir && vite preview --mode mock --outDir dist-mock --port 5179 --strictPort`. Running `pnpm build:mock` separately (to refresh `dist-mock` for new code) re-runs the `sh -c` chain, replacing the in-memory `vite preview` child process — which means all quote / location records created during the test session vanish. I observed this when a quote ID created earlier returned 404 after a rebuild, breaking the back-navigation test for hydration; took ~10 minutes to disambiguate "Option A code is broken" from "mock state was reset".

**What was expected:** that the mock server state would persist across rebuilds (typical of dev-mode HMR), or that the build wouldn't restart preview.

**Why it matters:** This is consumer-project tooling, not SKMTC itself. But the workflow assumption — "test the generator's output against a live mock canvas" — depends on rebuild cycles that don't reset state. When state DOES reset, a test loop investigating back-nav / hydration / persistence behaviours produces misleading results, and the agent's debugging path branches incorrectly.

**Possible fixes:** unresolved — out of scope for SKMTC. The skill could note "if your test loop uses a `vite preview` against built output, expect a state reset on rebuild; for stateful test scenarios use the dev server (`pnpm dev:mock` style) instead." Generic enough to be useful across consumer projects.

**Version anchor:** N/A (consumer-project tooling)

**Status:** open

---

### 6. `bodyWrapper` + `hidden` + `synthesized {prop}` triplet for stateful body chrome [win]

A compositional pattern that emerged from the location-form migration; the three new enrichments cover the full surface needed to express "form with cross-field stateful decoration" generically.

**What happened:** Migrating the hand-coded `CreateLocationForm` required three independent generator features, each modest in scope:

1. **`bodyWrapper: moduleRef`** — wraps the body JSX in a custom component inside `<form>` (so the wrapper has access to `useFormContext`). Used for: the geocoding provider + interactive map.
2. **`hidden: true` on `fieldConfig`** — field participates in form state (resolver pick, `EMPTY_VALUES`, values type, submit body) but renders no input; defaults to `undefined`; exempt from `.required()`. Used for: latitude/longitude written by the wrapper via `setValue`.
3. **`synthesized { id, prop: true }`** — body field value supplied by a required prop on the form's options. Used for: `customerId` (until the API path becomes `/v2/customers/{customerId}/locations` and `PathParamsHook` takes over).

Individually each is a small primitive. *Together* they express the shape "form with side-channel state owned by a wrapper component, plus host-supplied scalars." This shape is broadly applicable — future use cases (a calendar widget for a scheduling form, an autocomplete that reads from a peer field, a multi-resource picker writing back into the body) reduce to the same three primitives.

**Why it matters:** The natural impulse when faced with the location-form migration was to either (a) widen `gen-shadcn-form` with map-specific support, or (b) accept the hand-coded form as permanently bespoke. The triplet is a third path: generic primitives that compose to express the bespoke shape via consumer code. The wrapper component (here `LocationFormBodyShell`) is hand-written and lives next to the geocoding provider; the generator stays generic.

The pattern is *not* obvious from any one of the three enrichments in isolation. A skill section that names this compositional pattern — "stateful body chrome" or similar — and points at the location-form migration as the canonical example would teach future agents to reach for it.

**Possible fixes:** unresolved — `skmtc-generator` skill could add a "Composing enrichments: stateful body chrome" worked example after the existing scaffold sections.

**Version anchor:** `@skmtc/gen-shadcn-form` (cloned in `.skmtc/mobile-app/`); `@skmtc/core@0.5.1`

**Status:** open

---

### 7. `Required<Pick<>> & Pick<>` split type for mixed-modifier values [win]

The TypeScript emission pattern paired with #6's hidden-fields enrichment — worth codifying separately because it has standalone applicability.

**What happened:** As detailed in friction #3, mixing required-by-render fields with optional-by-modifier fields in one picked TS type requires the intersection `Required<Pick<Body, visible>> & Pick<Body, hidden>` rather than the simpler `Required<Pick<Body, all>>`. The pattern emerged naturally from the constraint (EMPTY_VALUES needs `undefined` for hidden fields) but isn't a TypeScript idiom most agents would reach for unprompted — most training data uses one or the other, not the intersection.

**Why it matters:** Any generator that mixes required-shaped and optional-shaped picks into one type benefits from this. It's adjacent to but distinct from "use `Required<Pick<>>` to strip optionality": that pattern is *too* strong when some fields legitimately want to keep their optionality. The intersection is the precise tool.

The pattern is invisible from the existing `Required<Pick<>>` scaffold in skill examples — agents extending the values-type emission would re-derive the same TS gotcha each time.

**Possible fixes:** unresolved — `skmtc-generator` skill's TS-emission section could carry the intersection example with the "preserves `?` modifier" rationale.

**Version anchor:** `@skmtc/gen-shadcn-form` (cloned); `@skmtc/core@0.5.1`

**Status:** open

---

### 8. Generator-side `nullableStringFieldNames` doesn't cover `T?` with constraints [friction]

Discovered earlier in the same session migrating the wizard's request-description step; the title-update spec was streamlined via OAS change. Logging here because the underlying generator limitation is broader than the one field.

**What happened:** `PatchSubmitBlock` emits an empty-to-null mapping only when the picked field's schema is `string` with `nullable: true`:

```ts
const valueExpr = this.nullableStringFieldNames.has(name)
  ? `values.${name} === '' ? null : values.${name}`
  : `values.${name}`
```

For the original `updateQuoteInputSchema.title: z.string().min(1).optional()` — non-nullable, optional, with `.min(1)` — neither branch fit:

- It's not nullable → not in `nullableStringFieldNames` → no empty-to-null mapping.
- After `.pick({...}).required()` the resolver enforces `.min(1)` → empty string from the form fails Zod.
- The wire wants either a valid string or the field omitted entirely.

The resolution this session was to nullable-ify the spec field (so it joins the existing empty-to-null path) — but that only worked because the consumer owned the OAS spec. A consumer who didn't would need either a per-field "empty-as-omit" generator option, or a more granular submit-mapping system that distinguishes:

- `string + nullable + optional` → empty maps to `null`
- `string + non-nullable + optional + min(1)` → empty maps to **omit** (not in body at all)
- `string + non-nullable + required + min(1)` → empty is a validation error (current behaviour)

Three shapes, three behaviours. The generator currently models only the first two as the same path.

**What was expected:** that the empty-form-value → wire mapping would cover every "optional in some sense" string shape.

**Why it matters:** Optional non-nullable strings with constraints are rare but not pathological — `title?: string.min(1)` is a natural "if you set it, set it well" shape. When the consumer can't change the spec, the generator's empty-string handling becomes a forcing function for an OAS spec change. That's brittle.

The session's outcome (change the spec to nullable) was the right call for FieldPlan but reveals a generator limitation worth naming.

**Possible fixes:** unresolved — `gen-shadcn-form` could grow a per-field `emptyAs: 'null' | 'omit'` (or infer from `nullable` + `optional` + `min`), or `@skmtc/core` could enrich its OAS parse layer to surface "the three optionality axes" as separate fields.

**Version anchor:** `@skmtc/gen-shadcn-form` (cloned); `@skmtc/core@0.5.1`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #6 — `bodyWrapper` + `hidden` + `synthesized {prop}` triplet | This compositional pattern is the highest-leverage finding of the session: future "form with cross-field stateful decoration" use cases (calendar pickers, autocompletes, multi-resource selectors) reduce to the same three primitives. Without an explicit "composing enrichments" example in the skill, agents would either widen the generator per-case or stay hand-coded. | `skmtc-generator` skill — add a "Stateful body chrome" worked example after §scaffolds, pointing at the location-form migration |
| 2 | #1, #2 — `skmtc bundle` failure + `skmtc generate` runs on stale bundle | Two CLI-level frictions that together break the test loop generators authoring depends on. The blocker (#1) plus the silent stale-bundle (#2) create a category of bug ("my code changes aren't reflected") that's costly to diagnose. | `skmtc-cli` skill — document the bundle-freshness expectation; SKMTC code — fix the path divergence in `bundleHeadless` and/or make `skmtc generate` mtime-aware |
| 3 | #3, K5 — `Required<Pick<>>` modifier vs value-union semantics | Generators emitting picked + required TS types will keep re-deriving this gotcha. The `Required<Pick<>> & Pick<>` intersection is the precise tool but is genuinely non-obvious; missing from training data and from the skill. | `skmtc-generator` skill — add to the TS-emission section with the modifier-vs-union explanation and the intersection pattern as the recipe |
