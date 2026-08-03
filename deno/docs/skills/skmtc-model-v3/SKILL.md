---
name: skmtc-model-v3
version: 0.1.1
description: >
  The model-generator shape for SKMTC: one definition per component
  schema, built by copying the shipped SKELETON package and filling its
  SLOT markers with the target library's syntax. Covers the edge cases
  every model generator must survive — refs, recursion, optional vs
  nullable, additionalProperties, enums, readOnly/writeOnly. Use when
  authoring or editing a generator that maps schemas to a
  validator/schema/type library ("write a gen-<lib>", "map OpenAPI
  models to <lib>"). Load ALONGSIDE skmtc-generator-v3 (engine rules)
  and skmtc-lang-typescript-v3 (TS layer).
---

# Model generators: fill the skeleton

A **model generator** turns each component schema (`refName`) into one
definition in one file: entry → projection → schema-type router → one
snippet class per schema type. That structure is invariant across
target libraries — only naming policy and per-type syntax vary. So do
not write the structure: copy it.

## 1. The method

The `skeleton/` directory next to this file is a complete, compiling,
engine-tested model generator that renders a placeholder syntax
(`m.object({...})`). Author by transplant, not from scratch:

1. **Copy** `skeleton/` to your package location; run
   `deno test --allow-env --allow-sys --allow-read` — 6 green tests
   prove the machinery before you touch anything.
2. **Rename**: `name` in `deno.json`; `MyLib` → `YourLib` in class
   names and filenames; `myLibEntry` → `yourLibEntry`; then
   `src/lib.ts` — `LIB_MODULE` (emitted module specifier) and `LIB`
   (imported symbol).
3. **Fill the slots** (§2), smallest first: scalars → string/enum →
   array/object → union → lazy/recursion annotation.
4. **Re-pin the test**: update the pinned strings in `mod.test.ts` to
   your target syntax. The structural assertions (files exist, shared
   refs dedup to ONE definition, import headers stitched, recursion
   annotated) must pass UNCHANGED — if one breaks, you broke machinery,
   not syntax.

Every slot is a `// SLOT(name):` comment. Everything outside a SLOT is
engine machinery — modifying it is almost always a mistake.

## 2. The slots

| Slot | File | Decision |
|---|---|---|
| `library` | `src/lib.ts` | emitted module + symbol, single point |
| `naming`, `identifier-kind`, `export-path` | `src/base.ts` | identity policy (from `refName` ONLY) |
| `string`, `string-constraints` | `src/MyLibString.ts` | string / enum / literal syntax; formats, min/maxLength |
| `number`, `integer`, `boolean`, `unknown`, `void` | `src/MyLibScalars.ts` | scalar syntax; numeric constraints |
| `array` | `src/MyLibArray.ts` | list syntax |
| `object-properties`, `object-intersection`, `object-empty`, `visibility` | `src/MyLibObject.ts` | object syntax; properties+record composition; readOnly/writeOnly policy |
| `record` | `src/MyLibObject.ts` | additionalProperties map syntax |
| `union` | `src/MyLibUnion.ts` | oneOf/anyOf; discriminated form |
| `lazy` | `src/MyLibRef.ts` | deferred-reference form for cycles |
| `recursion-annotation` | `src/MyLibProjection.ts` | type annotation breaking circular inference |
| `modifiers` | `src/modifiers.ts` | optional/nullable syntax and wrap order |
| `enrichments` | `src/enrichments.ts` | config seam (default: opt-out) |

## 3. Edge cases the skeleton already handles — keep them working

- **Refs are names, never expansions.** `MyLibRef` puts only the peer's
  NAME in the value tree; the `ModelDriver` resolves the definition
  (cache hit → reuse, miss → construct) and stitches the cross-file
  import. Inline-expanding a ref, or hand-writing its import, is how
  shared models duplicate.
- **Recursion is a protocol, not a special case.** A back-reference to
  a model still open on the build stack (`context.modelDepth` > 0)
  renders via SLOT(lazy) and bumps the depth; the projection then sees
  `> 1` and sets `settings.identifier.typeName` (SLOT
  recursion-annotation) so the emitted `export const` doesn't die of
  circular inference (TS7022/7024). Self-recursion only — mutual
  recursion is not detected.
- **Optional and nullable are different axes.** `required` comes from
  the PARENT object's `required` list and flows into each property
  leaf's `modifiers`; `nullable` sits on the node itself. Both render
  exactly once, in `applyModifiers`, at the leaf — no other owner, and
  never while building stored fields.
- **additionalProperties** → the record path; `true`/empty schema →
  the unknown fallback; properties + additionalProperties together →
  SLOT(object-intersection).
- **Property keys** go through `handleKey` — `'first-name'` renders
  quoted; never assume keys are identifiers.
- **Visibility.** `readOnly`/`writeOnly` are captured per property in
  `MyLibObjectProperties.visibility`. Default policy ignores them; if
  the target needs them, annotate the value (e.g. `.readonly()`) or
  emit request/response variants via `variant` threading — decide at
  SLOT(visibility).
- **Unknown never throws.** Untyped schemas route to the unknown
  fallback so one odd schema can't kill the subject. `custom` values
  pass through untouched.
- **TypeSystem contracts.** Each snippet class carries the fields peers
  rely on (`TypeSystemString` needs `format` + `enums`; objects expose
  `objectProperties`/`recordProperties`). Add fields freely; remove
  none — removal breaks `insertNormalizedModel` consumers and fails the
  `SchemaToValueFn` check.

## 4. Verify

The shipped `mod.test.ts` runs the REAL pipeline (`toArtifacts`) over a
fixture with an enum, an array-of-ref, a shared ref (×2 → one
definition), optional + nullable, a record, and a self-recursive model.
It is your regression gate: green before you start, green after every
slot. Read failures in this order: import header first (a missing
import means a string swallowed a snippet), then the body, then
`deno lint` (the `skmtc/*` rules are wired in `deno.json`).

## 5. Model-generator pitfalls

| Symptom | Fix |
|---|---|
| Shared model duplicated per consumer | A ref was rendered/expanded instead of flowing through `MyLibRef` |
| Stack overflow on recursive schema | The `modelDepth` branch in `MyLibRef` was removed or bypassed |
| Emitted file dies of TS7022/7024 | SLOT(recursion-annotation) not set for the target |
| `.optional()` doubled or missing | Modifiers applied outside `applyModifiers`, or a second owner added |
| Enum with `null` member renders `'null'` | Keep the `literal()` null-guard from `MyLibString` |
| Peer generator can't consume yours | `schemaToValueFn`/`createIdentifier` statics or TypeSystem contract fields removed |
| Lint fires `no-template-imports`/`no-adhoc-tostring` | Target syntax leaked outside a `toString()` body — move it into the SLOT |

## 6. Boundaries

Engine semantics (the one law, memoization, enrichments, variants,
naming rules) live in **skmtc-generator-v3** — read it first. TS-layer
specifics (register shapes, identifier kinds, import machinery,
`List`/`FunctionParameter`) live in **skmtc-lang-typescript-v3**. This
skill owns only the model SHAPE. The skeleton is TypeScript-emitting;
for a Kotlin model generator, keep this skill's shape and edge-case
rules but take call shapes from skmtc-lang-kotlin-v3 (no Kotlin
skeleton yet). Operation generators are a different shape — load
`skmtc-operation-v3`; accumulators are covered by neither (clone
`gen-msw`/`gen-express` per skmtc-generator-v3 §2).
