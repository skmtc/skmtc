# 2026-05-31 — Reapit generated-code type-safety sweep

Drove the cloned `@reapit/gen-*` generators (react-query-zod, elemental
table/select/form) from 1263 TypeScript-7 (`tsgo`) errors in their generated
output down to 0, plus 0 oxlint errors. Involved editing every generator,
building a new project-local `@reapit/refs` package, two new consumer field
components, and a per-field `useFieldArray` redesign. Many fixes hinged on
non-obvious core / `@hookform/lenses` behaviour discovered by reading source.

## Knowledge acquired

Authoring/editing cloned operation generators that emit React + react-hook-form
+ `@hookform/lenses` code, type-checked with TypeScript 7 (`tsgo`).

| # | What I learned | Doc implication |
|---|----------------|-----------------|
| K1 | `FunctionParameter` / `toDestructured` (core) emit **unquoted** keys for non-identifier property names in destructured params — e.g. a param type with an `If-Match` / `user-id` key renders `{If-Match: ifMatch}` / `{user-id: userId}`, which is invalid JS in a binding pattern. `FunctionParameter.test.ts` asserts this exact output. To destructure args containing non-identifier keys you must build it yourself with `List.fromKeys(props).toObject(k => isIdentifierName(k) ? k : List.toKeyValue(handleKey(k), camelCase(k)))` — `handleKey` is what adds the quotes; `toDestructured` does NOT call it. | `skmtc-generator` skill + core API reference for `FunctionParameter` — note the non-identifier-key footgun |
| K2 | `Identifier.createVariable(name, typeName?)` — the **second arg is a type annotation**, rendered as `const name: typeName = value`. This is how to type a generated `const` (e.g. an empty `columns: ColumnDef<Row>[] = []`). | API reference for `Identifier` — the `typeName` param is undocumented in the skill |
| K3 | `TsObject` decides a property's optional `?` from the **property value's `modifiers.required`**, and `'modifiers' in value ? … : ''` — a `CustomValue` has no `modifiers`, so it **never** gets `?` and always renders as required. Therefore `addProperty({ name, schema: new CustomValue(...), required: false })` does **not** produce an optional property. Use a real schema (`new OasString()`) for an optional prop. (`gen-typescript/src/TsObject.ts:132`.) | `skmtc-generator` skill — "CustomValue can't be optional"; gen-typescript reference |
| K4 | `@hookform/lenses`: `useFieldArray(lens.interop())` and `lens.interop()`+`Controller` only resolve their conditional shim types (`ShimKeyName`, `HookFormControlShim<T>`) for a **concrete** item type. A generic wrapper component (`<T>(lens: Lens<T[]>)`) cannot satisfy the field-array shim — you must emit a **per-field concrete-typed component**. `Lens<T>` is **invariant** (`Lens<Record<string,unknown>>` is NOT assignable to `Lens<unknown>`). But a component generic over a concrete *shape* (`<V>(lens: Lens<Record<string, V>>)`) DOES resolve, because the shape is concrete even with a generic value. | New how-to: "generating react-hook-form + lenses forms" |
| K5 | Deriving a generated table's row type by **indexing the hook's own return type** — `NonNullable<NonNullable<ReturnType<typeof useGetX>['data']>['_embedded']>[number]` — keeps the column-helper type byte-identical to the `data` it renders, eliminating a `ColumnDef<TsProjectionType>` vs `ColumnDef<zodInferredType>` mismatch. Re-projecting the same schema twice (TsProjection for the row + zod for the response) yields structurally-different types that fail to unify. | `skmtc-generator` skill — "one source of truth for derived types" pattern |
| K6 | Heterogeneous TanStack columns (mixed `TValue` per column) only unify under `ColumnDef<TData, any>[]` *or* a per-property mapped union `type ColumnForRow<TData> = { [K in keyof TData]-?: ColumnDef<TData, TData[K]> }[keyof TData]` then `ColumnForRow<TData>[]`. The mapped type keeps `TData` strict and avoids `any`. (`ColumnDef<TData, unknown>[]` fails on cell-fn contravariance.) | Pattern note — useful for any table-component consumer |
| K7 | `context.insertNormalizedModel(Projection, { schema, fallbackName, destinationPath })` is callable from a plain `SnippetBase` (the context method needs `destinationPath` explicit, unlike the projection-base wrapper). Combined with `context.defineAndRegister({ identifier, value, destinationPath })`, a Snippet can emit a sibling component `const` into the consuming file (the gen-elemental-select MultiSelectField pattern, reusable for object-array field components). | Already partially in skill; add the Snippet-from-context usage |
| K8 | `skmtc generate --json` interleaves `[WARN]` parse-issue logs (with ANSI colour codes) on **stdout**, so the result object must be extracted by grepping the `{"kind":"generated"…}` line — `--json` does not produce a clean single-object stdout. | `skmtc-cli` skill / possible CLI bug — strict-JSON mode should keep logs on stderr |
| K9 | Generation is deterministic (two consecutive runs are byte-identical), but editing generator **A** can change the output file of generator **B** when both feed the same `insertNormalizedModel` normalized type — this is deterministic cross-generator coordination, not non-determinism. Easy to misread a diff between two edits as flakiness. | `concepts/cross-generator-coordination.md` — call out the "shared normalized model changes ripple" effect |

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | FunctionParameter emits unquoted non-identifier keys | friction | open |
| 2 | CustomValue + addProperty(required:false) never renders optional | friction | open |
| 3 | @hookform/lenses field shim needs concrete types; Lens is invariant | friction | open |
| 4 | Heterogeneous TanStack columns without `any` (mapped type) | win | open |
| 5 | Hook-derived row type avoids TsProjection-vs-zod divergence | win | open |
| 6 | rules-of-hooks: lens guard placed before hooks in generated components | friction | open |
| 7 | `generate --json` pollutes stdout with WARN logs | polish | open |

---

### 1. FunctionParameter emits unquoted non-identifier keys [friction]

Fixing `@reapit/gen-react-query-zod` mutation hooks: the generated `mutationFn`
referenced `body`/`id` that were never destructured, and ~40 PATCH/DELETE ops
carried an `If-Match` header param.

**What happened:** I expected to fix the "no parameter" bug by emitting
`this.parameter` (a `FunctionParameter` with `destructure: true`). But
`FunctionParameter.toString()` / `toDestructured` render non-identifier keys
**unquoted** — for an args type with an `If-Match` key it produces
`{If-Match: ifMatch, id, body}: Args`, a syntax error. `FunctionParameter.test.ts`
literally asserts `{user-id: userId, api-key: apiKey}`.

**What was expected:** that `FunctionParameter` with `destructure: true` would
quote invalid identifier keys (it knows the key strings).

**Why it matters:** `FunctionParameter` is the obvious tool for destructured
params and looks safe from its type signature, but silently emits invalid JS for
real-world OpenAPI param names (headers like `If-Match`, hyphenated keys). The
fix is to hand-build the destructuring with `handleKey` (which quotes) +
`camelCase` alias — the same transform the generator already used for its
`headerParams` object, just applied to the whole param. The reference
`gen-tanstack-query-fetch-zod` has the identical latent bug.

**Possible fixes:** unresolved — `toDestructured` could call `handleKey(key)`
instead of the raw `key` for the non-identifier branch (one-line core change),
or the skill could warn that `FunctionParameter` is unsafe for non-identifier
keys and show the manual pattern.

**Version anchor:** `@skmtc/core@0.6.6`, `@reapit/gen-react-query-zod@0.0.60`

**Status:** open

---

### 2. CustomValue + addProperty(required:false) never renders optional [friction]

Making a generated select's `value`/`placeholder` props optional in
`@reapit/gen-elemental-select`.

**What happened:** I set `addProperty({ name: 'value', schema: new CustomValue({...'string'}), required: false })`
and expected `value?: string`. The generated prop stayed `value: string`
(required). `addProperty` correctly omitted `value` from the object's `required`
array, but `TsObject` renders `?` from the *property value's* `modifiers.required`
via `'modifiers' in value ? (value.modifiers.required ? '' : '?') : ''`
(`TsObject.ts:132`). A `CustomValue` has no `modifiers`, so the ternary's else
branch fires and it's always emitted without `?`.

**What was expected:** that the parent object's `required` array (which
`addProperty` does populate) drives the `?`, so `required: false` → optional.

**Why it matters:** the `required` flag on `addProperty` is a no-op for
`CustomValue` properties — a silent disconnect between the API you call and the
output. The workaround is to use a real schema (`new OasString()`) for any
optional property; reserve `CustomValue` for required props or where you don't
need optionality. Cost me a wrong first attempt (made `value` optional, saw no
change, then traced it to TsObject).

**Possible fixes:** unresolved — `TsObject` could honour the parent `required`
array for keys whose value lacks `modifiers`, or the skill/`CustomValue` docs
could state that `CustomValue` props are always required.

**Version anchor:** `@skmtc/core@0.6.6`, `@reapit/gen-typescript@0.0.60`

**Status:** open

---

### 3. @hookform/lenses field shim needs concrete types; Lens is invariant [friction]

Replacing a broken generic consumer `ListField<T extends Record<string,unknown>>`
and building new `JsonField` / object-array components in
`@reapit/gen-elemental-form`.

**What happened:** Three intertwined surprises across several cycles:
1. `useFieldArray(lens.interop())` over a generic `Lens<T[]>` does not type-check
   — the `ShimKeyName` conditional can't resolve for abstract `T` (errors with a
   `LensInteropTransformerBinding` vs `UseFieldArrayProps` mismatch). The
   documented `useFieldArray(lens.interop())` example only works for a *concrete*
   `Lens<{…}[]>`.
2. `Lens<T>` is **invariant**: `Lens<Record<string, unknown>>` is not assignable
   to `Lens<unknown>`, and `Lens<{}>` is not assignable to
   `Lens<Record<string, unknown>>`. So a single non-generic consumer component
   can't absorb differently-typed object lenses.
3. A component generic over a **concrete shape** — `<V>(lens: Lens<Record<string, V>>)`
   — *does* resolve (and accepts both `Record<string,unknown>` and
   `Record<string,string>`), because the shape is concrete even with a generic
   value; a component generic over the whole type (`<T>(lens: Lens<T>)`) does not.

**What was expected:** that a generic reusable form-array/object component would
type-check the same as a concrete one (it doesn't), and that `Lens` would be
covariant (it isn't).

**Why it matters:** this dictates the whole shape of an `@hookform/lenses` form
generator. You **cannot** emit one generic `ListField`/`JsonField` and reuse it;
you must either (a) generate a per-field concrete-typed component (what I did for
object arrays: emit `const XArrayField = ({lens}: {lens: Lens<XRow[]>}) => { useFieldArray(lens.interop()); lens.map(fields, (value, lens, index) => …) }`),
or (b) constrain the generic to a concrete shape (`Record<string, V>`). The
JsonField went through unknown → concrete → generic-V before landing.

**Possible fixes:** unresolved — needs a how-to doc capturing the three rules and
the per-field-component pattern; this is the single biggest cycle sink of the
session and applies to any RHF+lenses form generator.

**Version anchor:** `@skmtc/core@0.6.6`, `@reapit/gen-elemental-form@0.0.60`, `@hookform/lenses@0.9.0`

**Status:** open

---

### 4. Heterogeneous TanStack columns without `any` (mapped type) [win]

Typing the consumer `DataTable` so a generated `columns` array of mixed-value
columns (string, boolean, number) type-checks.

**What happened:** `createColumnHelper<Row>().accessor(...)` columns have a
per-column `TValue`; an array of them won't unify against
`ColumnDef<TData, TValue>[]` (single `TValue`) — TanStack's own idiom is
`ColumnDef<TData, any>[]`. To avoid `any`, a per-property mapped union works:
```ts
type ColumnForRow<TData> = { [K in keyof TData]-?: ColumnDef<TData, TData[K]> }[keyof TData]
// columns: ColumnForRow<TData>[]
```
Each column matches the union member for the property it targets; `TData` stays
strict. `ColumnDef<TData, unknown>[]` does NOT work (cell-fn contravariance).

**Why it matters:** "use `any` for the column TValue" is the widely-repeated
TanStack answer; a strict generator (no-`any` rule) needs the non-`any`
alternative, and it isn't obvious. Another agent told to type a generated
columns array would almost certainly reach for `any` or fight `unknown`.

**Possible fixes:** codify the `ColumnForRow` mapped type as the prescribed
shape for generated table components.

**Version anchor:** `@reapit/gen-elemental-table@0.0.60`, `@tanstack/react-table@8.21.3`

**Status:** open

---

### 5. Hook-derived row type avoids TsProjection-vs-zod divergence [win]

The generated table's `createColumnHelper<RowType>()` row type didn't match the
`data` the table rendered, producing an invariant `ColumnDef<…>` mismatch on the
one complex table (Applicants).

**What happened:** the row type was a *second* projection of the list-item schema
(`insertNormalizedModel(TsProjection, …)`), while `data` is `z.infer` of the
zod response — two structurally-different representations of one schema. Indexing
the hook's own return type instead —
`NonNullable<NonNullable<ReturnType<typeof useGetX>['data']>['<listKey>']>[number]`
— makes the column type *the same type* as the rendered data by construction.

**Why it matters:** any generator that produces both a typed view and the data
feeding it (tables, lists, grids) risks this divergence when it re-projects the
schema independently. "Derive the view type by indexing the data source" is the
robust pattern and isn't written down. (I initially mis-attributed the symptom
to non-determinism — see K9 — before finding the real cause.)

**Possible fixes:** codify "index the hook/data type rather than re-projecting"
in the generator skill.

**Version anchor:** `@reapit/gen-elemental-table@0.0.60`, `@reapit/gen-react-query-zod@0.0.60`

**Status:** open

---

### 6. rules-of-hooks: lens guard placed before hooks in generated components [friction]

`@reapit/gen-elemental-select`'s generated `XMultiSelectField` failed
`react-hooks/rules-of-hooks` (14 oxlint errors) — caught only because oxlint was
wired up, not by `tsgo`.

**What happened:** the generated component emitted `if (!lens) return null` and
*then* `useGetApiX(...)` + `useMemo(...)`. Hooks after a conditional early return
violate the rules of hooks. `lens` is a required prop (`Lens<string[]>`), so the
guard was dead code anyway. Fix: remove the guard (lenses are non-optional).

**What was expected:** nothing flagged it at the type level — `tsgo` was happy; a
generator author relying only on type-checking would ship a runtime hook-order
bug.

**Why it matters:** generators emitting React components with hooks must place
all hook calls before any conditional return, and should not emit defensive
`if (!requiredProp) return null` guards. This is invisible to `tsgo` — it needs a
lint pass (or a generator-side convention). Worth a generator-skill note for
anyone emitting hook-using components.

**Possible fixes:** unresolved — generator-skill guidance ("no early return before
hooks; required props don't need guards"), and a recommendation to run a
react-hooks lint over generated output as part of verification.

**Version anchor:** `@reapit/gen-elemental-select@0.0.60`

**Status:** open

---

### 7. `generate --json` pollutes stdout with WARN logs [polish]

Trying to read the structured result of `skmtc generate <project> --json`.

**What happened:** stdout contained ANSI-coloured `[WARN] … {parseIssue json}`
lines interleaved with the final `{"kind":"generated", …}` object, so
`JSON.parse(stdout)` fails; I had to `grep -o '{"kind":"generated".*'` to recover
the result. The `skmtc-cli` skill states strict-JSON mode emits "a single JSON
object on stdout. Logs/warnings on stderr."

**Why it matters:** the documented contract (logs on stderr in `--json` mode)
doesn't hold for parse-issue warnings, so any agent/script consuming `--json`
output programmatically will break on a schema that emits warnings (common).

**Possible fixes:** unresolved — route parse-issue WARN logs to stderr in
`--json`/`--no-input` mode, or document that the result is the last line.

**Version anchor:** `@skmtc/cli@0.4.2`, `@skmtc/core@0.6.6`

**Status:** open

---

## Priority for docs/skills

| Rank | Entry | Why it matters | Action path |
|------|-------|----------------|-------------|
| 1 | #3 — @hookform/lenses field shim / Lens invariance | Biggest cycle sink; dictates the entire architecture of any RHF+lenses form generator (per-field concrete components, no generic wrappers) and isn't written anywhere. | New how-to doc: "generating react-hook-form + @hookform/lenses forms" |
| 2 | #1 — FunctionParameter unquoted non-identifier keys | A core utility silently emits invalid JS for real header/param names (`If-Match`); the reference generator has the same latent bug. | core API reference + `skmtc-generator` skill note; consider a `handleKey` fix in `toDestructured` |
| 3 | #2 — CustomValue can't be optional via `addProperty(required:false)` | Silent API disconnect (`required` flag is a no-op for CustomValue props) that produces wrong output and is hard to trace to `TsObject.ts:132`. | `skmtc-generator` skill + CustomValue/TsObject reference |
