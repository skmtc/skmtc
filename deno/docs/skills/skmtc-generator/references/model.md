# Model generators: fill the skeleton

A **model generator** turns each schema (by its `ref`) into one
definition in one file: the entry, a projection, a router over schema
types, and one snippet class for each schema type. That structure is the
same for every target library. Only the naming rule and the code for
each type differ. So copy the structure, and write only what differs.

## 1. The method

`skeleton/` in this skill (`../skeleton/` from this file) is a complete
model generator that compiles, is tested against the engine, and
renders a placeholder syntax (`m.object({...})`). It is a tree of
producers as `producers.md` describes: one router, one class for each
schema type, names in `base.ts`.

1. **Copy** `skeleton/` to your package location; run
   `deno test --allow-env --allow-sys --allow-read` — 9 green tests
   prove the machinery before you touch anything.
2. **Rename**: `name` in `deno.json`; `MyLib` → `YourLib` in class
   names and filenames; `myLibEntry` → `yourLibEntry`; then
   `src/lib.ts` — `LIB_MODULE` (emitted module specifier) and `LIB`
   (imported symbol).
3. **Fill the slots** (section 2), smallest first: scalars → string/enum →
   array/object → union → lazy/recursion annotation.
4. **Re-pin the test**: update the pinned strings in `mod.test.ts` to
   your target syntax. The structural assertions (files exist, shared
   refs dedup to ONE definition, import headers stitched, recursion
   annotated) must pass UNCHANGED — if one breaks, you broke machinery,
   not syntax.

Every slot is a `// SLOT(name):` comment. Everything outside a SLOT is
engine machinery — modifying it is almost always a mistake.

When your library needs something the skeleton has no slot for, add a
class and a router case (`SKILL.md`, "When a case does not fit"). Do
not add a function that inspects the schema before the router does.

## 2. The slots

| Slot | File | Decision |
|---|---|---|
| `library` | `src/lib.ts` | emitted module + symbol, single point |
| `naming`, `identifier-kind`, `export-path` | `src/base.ts` | identity policy (from `ref.refName`, and `ref.refPath` when you name refs into deep paths apart) |
| `string`, `string-constraints` | `src/MyLibString.ts` | string / enum / literal syntax; formats, min/maxLength |
| `number`, `integer`, `boolean`, `unknown`, `void` | `src/MyLibScalars.ts` | scalar syntax; numeric constraints |
| `array` | `src/MyLibArray.ts` | list syntax |
| `object-properties`, `object-intersection`, `object-empty`, `visibility` | `src/MyLibObject.ts` | object syntax; properties+record composition; readOnly/writeOnly policy |
| `record` | `src/MyLibObject.ts` | additionalProperties map syntax |
| `union` | `src/MyLibUnion.ts` | oneOf/anyOf; discriminated form |
| `intersection` | `src/MyLibIntersection.ts` | an `allOf` that keeps a reference |
| `lazy` | `src/MyLibRef.ts` | deferred-reference form for cycles |
| `recursion-annotation` | `src/MyLibProjection.ts` | type annotation breaking circular inference |
| `modifiers` | `src/modifiers.ts` | optional/nullable syntax and wrap order |
| `enrichments` | `src/enrichments.ts` | config seam (default: opt-out) |

## 3. Edge cases the skeleton already handles — keep them working

- **Refs are names, never expansions.** `MyLibRef` puts only the peer's
  NAME in the value tree; `toModelRef` resolves the definition through
  the `ModelDriver` (cache hit → reuse, miss → construct) and stitches
  the cross-file import. Inline-expanding a ref, or hand-writing its
  import, is how shared models duplicate.
- **A ref can point inside a schema.** A `$ref` into a `$defs` entry,
  a property or `#/paths/…` resolves like a component ref, and its
  target becomes a model of its own. The router passes the `OasRef` to
  `MyLibRef` as `ref`, `MyLibRef` passes it to `toModelRef`, and the
  projection resolves its schema with `resolveSchemaRefOnce(ref)`. The
  model API takes the whole `ref` (`{ refName, refPath }`), so no call
  can drop the path.
  The skeleton's `base.ts` names by `toModelName(ref)`: a component's
  `refName`, and a name from the whole pointer of any other target. With
  `ref.refName` alone, two deep targets that share it
  (`…/properties/disk` twice) collide with
  `Registered definition mismatch`.
- **A ref can name nothing.** By default (`settings.parse.danglingRefs:
  []`; `settings.system`, its old name, still works but is deprecated,
  and `skmtc migrate config <project>` renames it) the parser removes what holds such a `$ref`, so your generator
  never sees it. When the list has `schema`, a schema `$ref` stays, and
  inserting or resolving it throws `DanglingRefError`
  (from `@skmtc/core`). To render the item, catch it in your ref
  snippet and render the unknown fallback. Test it with
  `DanglingRefError.is(error)` and throw any other error again;
  `instanceof` is false when your bundle has another copy of core.
- **Recursion is a protocol, not a special case.** While a model's
  projection is constructed, the model has a pending entry. A reference
  back to it comes out of `toModelRef` as `suspended`; any other
  reference inside the cycle comes out with `inCycle`. Both render via
  SLOT(lazy), since any model of a cycle can be the first one loaded.
  The model's projection then sees `isReferencedBack({ context,
  settings })` and sets `settings.identifier.typeName` (SLOT
  recursion-annotation) so the emitted `export const` doesn't die of
  circular inference (TS7022/7024). This covers self-recursion and a
  cycle of several models; in a cycle, the model the cycle started from
  carries the annotation.
- **An `allOf` can keep a reference.** The parser merges an `allOf` into
  one schema, so it usually comes to the router as an object. A `$ref`
  that closes a cycle stays a ref: the schema is an `OasIntersection` of
  the kept refs and at most one other schema (`parse.intersections`).
  `MyLibIntersection` routes each member, so the refs render lazily as
  any other. When a kept ref leads back to the intersection with no
  property between (`A: { allOf: [B, …] }`, `B: { oneOf: [A, …] }`), most
  libraries cannot render the loop. What to write there is your decision.
- **Optional and nullable are different axes.** `required` comes from
  the PARENT object's `required` list and flows into each property
  leaf's `modifiers`; `nullable` sits on the node itself. Both render
  exactly once, in `applyModifiers`, at the leaf — no other owner, and
  never while building stored fields.
- **additionalProperties** → the record path; `true`/empty schema →
  the unknown fallback; properties + additionalProperties together →
  SLOT(object-intersection).
- **An object schema has four forms.** Properties only, a record only
  (`additionalProperties`), both, and empty: each place an object
  renders must handle all four. In TypeScript one expression serves as
  a type and as a declaration (`z.object({...})`, and
  `.and(z.record(...))` for both), so the object slots compose. Section
  6 covers a language where the two positions differ.
- **A discriminated union is one expression in TypeScript**
  (`z.discriminatedUnion("type", [...])`), at SLOT(union). Section 6
  covers a language that has no union type.
- **Property keys** go through `handleKey` — `'first-name'` renders
  quoted; never assume keys are identifiers.
- **Visibility.** `readOnly`/`writeOnly` are captured per property in
  `MyLibObjectProperties.visibility`, through `isReadOnly()` and
  `isWriteOnly()`. On a reference these read the reference's own
  keyword (`{ allOf: [{ $ref }], readOnly: true }`) and what it points
  to. Default policy ignores them; if
  the target needs them, annotate the value (e.g. `.readonly()`) or
  emit request/response variants via `variant` threading — decide at
  SLOT(visibility). Caller options are the third route: declare the
  second type parameter of `toTsModelProjectionBase`, let the calling
  generator pass `{ options }` on the insert, and fold them into the name.
- **Unknown never throws.** Untyped schemas route to the unknown
  fallback, since one throw fails the whole run. `custom` values
  pass through untouched.
- **TypeSystem contracts.** Each snippet class carries the fields peers
  rely on (`TypeSystemString` needs `format` + `enums`; objects expose
  `objectProperties`/`recordProperties`). Add fields freely; remove
  none — removal breaks `insertNormalizedModel` consumers and fails the
  `SchemaToValueFn` check.

## 4. Verify

The shipped `mod.test.ts` runs the REAL pipeline (`toArtifacts`) over a
fixture with an enum, an array-of-ref, a shared ref (×2 → one
definition), optional + nullable, a record, a self-recursive model, a
cycle of two models, and an `allOf` that keeps a reference.
It is your regression gate: green before you start, green after every
slot. Read failures in this order: import header first (a missing
import means a string swallowed a snippet), then the body, then
`deno lint` (the `skmtc/*` rules are wired in `deno.json`).

## 5. Model-generator pitfalls

| Symptom | Fix |
|---|---|
| Shared model duplicated per consumer | A ref was rendered/expanded instead of flowing through `MyLibRef` |
| `'X' … is being constructed further up the stack` | A ref bypassed `toModelRef` (for example `new ModelDriver(...)` in `MyLibRef`): a reference back must come out `suspended` |
| Generated module throws `Cannot access 'x' before initialization` | A reference inside a cycle rendered without SLOT(lazy): defer on `suspended \|\| inCycle`, not on `suspended` alone |
| Emitted file dies of TS7022/7024 | SLOT(recursion-annotation) not set for the target |
| `.optional()` doubled or missing | Modifiers applied outside `applyModifiers`, or a second owner added |
| Enum with `null` member renders `'null'` | Keep the `literal()` null-guard from `MyLibString` |
| Peer generator can't consume yours | `schemaToValueFn`/`createIdentifier` statics or TypeSystem contract fields removed |
| Lint fires `no-template-imports`/`no-adhoc-tostring` | Target syntax leaked outside a `toString()` body — move it into the SLOT |
| `data class NameMap<String, Any?>` (head glued to a type) in output | Declaration kind and value were decided separately — see section 6; kind and value must come from the same schema guards |

## 6. A language with a declaration head (Kotlin)

The skeleton writes TypeScript. For a Kotlin model generator, keep the
shape and the edge-case rules of this page, and take the calls from the
Kotlin lang package. There is no Kotlin skeleton.

- **The declaration and the type position differ, so one `toString()`
  cannot serve both.**
  - An object with properties only declares as a `data class`
    parameter list. In type position it must render a name: make a
    named declaration beside it and refer to that (`engine.md`,
    "Another generator's output", steps 3 and 4). A parameter list in
    type position parses as a function type and fails.
  - A record only, and an empty object, take no `data class` head
    (`data class X()` is illegal). Their declaration kind is
    `typealias`.
  - Properties with a record have a declaration form (a data class
    with a `@field:JsonAnySetter @get:JsonAnyGetter` map property) and
    no anonymous type form.
  - Decide the identifier kind and the value together, from the same
    guards on the schema. `shape.ts` in `gen-kotlin-jackson` is the
    worked example.
- **A discriminated union can be a declaration.** In a language with
  no union type, a discriminated union that qualifies is a named
  `sealed` declaration, and each member model declares the supertype.
  A member can be built before its union is seen, so membership comes
  from one scan of the document that the member reads when it is
  built, never from the union's own walk. A union that does not
  qualify renders the wire type (`JsonNode`), not `Any`.

## 7. Where the rest is

- What the engine does, enrichments, variants and naming: `engine.md`.
- Register calls, identifier kinds, imports, `List` and
  `FunctionParameter`: `typescript.md`.
- Operation generators: `operation.md`. Accumulators: clone
  `@skmtc/gen-msw` or `@skmtc/gen-express` (`engine.md`, "Two shapes of
  generator").
