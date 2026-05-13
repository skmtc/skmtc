# 2026-05-13 — Promote supplemental Snippets to Projections

Continuation of the same `gen-shadcn-form` work as
`2026-05-13-shadcn-form-allow-list.md`, but with a distinct focus:
lifting the "multi-export inside one Definition's value string" hack
that had been pervasive in `ShadcnFormHook.toString()` and
`ShadcnForm.toString()`. The result is nine Projections per generated
form file (`FormValuesType`, `FormOptionsType`, `FormStateType`,
`FormEmptyValues`, optional `PathParamsHook`, `ShadcnFormHook`,
`FormBody`, `FormBodyPropsType`, `FormPropsType`, `ShadcnForm`) —
each owning its own first-class Definition rather than being
concatenated into a sibling's value string.

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `.bind(config)` in `toOasOperationProjectionBase` freezes `this.toIdentifier` in the inherited `toExportPath` | friction | open |
| 2 | Projection-wrapper `register` auto-fills destinationPath; Snippet `register` requires it | friction | open |
| 3 | Projection constructor signature is fixed at `{context, operation, settings}` — Projections must be self-contained | friction | open |
| 4 | `isSupported` static-override typing trap when base config didn't specify it | friction | open |
| 5 | "File-scope export disguised as Snippet" is a discoverability anti-pattern the skill doesn't name | friction | open |
| 6 | "Snippet parameterized by hardcoded values its sole caller always passes" anti-pattern | friction | open |
| 7 | Self-contained Projections via cache-idempotent dispatch — same-File composition is free at runtime | win | open |
| 8 | `Identifier.createVariable(name, typeName?)` carries the typed-const annotation through the Driver | win | open |

---

### 1. `.bind(config)` in `toOasOperationProjectionBase` freezes `this.toIdentifier` in the inherited `toExportPath` [friction]

Investigating why `ShadcnFormHook` (identifier override: `useFooForm`)
ends up in `CreateCustomerForm.generated.tsx`, not the `useFooForm.generated.tsx`
that its overridden `toIdentifier` would imply.

**What happened:** `base.ts` has a comment that reads:

> `toExportPath` is polymorphic via `this.toIdentifier(...)`. Subclasses
> that override `toIdentifier` automatically get their own export path
> through this base — the form's hook Projection (`ShadcnFormHook`) lives
> at `@/components/forms/useFooForm.generated.tsx` simply by overriding
> `toIdentifier` to prepend `use`.

This is wrong. The factory in `toOasOperationProjectionBase.ts:52-53` does:

```ts
static toIdentifier = config.toIdentifier.bind(config)
static toExportPath = config.toExportPath.bind(config)
```

Both methods are bound to the *config object*. Inside the base config's
`toExportPath`, the expression `this.toIdentifier(...)` resolves to
`config.toIdentifier`, not to the subclass's override. So
`ShadcnFormHook.toExportPath(...)` returns the same path as
`ShadcnForm.toExportPath(...)`, with no participation from the
subclass-overridden `toIdentifier`.

Practical consequence: this is *why* multiple Projections-extending-
the-same-base end up in the same `.generated.tsx` File — and that's
the load-bearing mechanic for sibling Definitions. But it's the
opposite of what the comment promises, and the polymorphism-via-`this`
mental model is what a TS reader will reach for first.

**What was expected:** the inherited `toExportPath` would invoke the
subclass's `toIdentifier` override.

**Why it matters:** the discrepancy between what `.bind(config)` does
and what the comment claims sent me down ~20 minutes of "the file
structure can't possibly be what I'm seeing" before I read the factory
source. The mechanic is intentional and necessary (sibling Definitions
sharing a File depend on it) — the comment is just misleading. Without
reading the factory directly, an LLM (or a human) can spend real time
reverse-engineering this.

There's a knock-on consequence too: when you *do* want a subclass to
land in its own file (a hypothetical future split of hook and wrapper
into separate `.generated.tsx` files), you need to override BOTH
`toIdentifier` AND `toExportPath` in the subclass. Just overriding
`toIdentifier` is silent: the file path stays the base's.

**Possible fixes:** unresolved. The comment in `base.ts` describes
behavior that doesn't match the code; fixing the comment is the
obvious step. Alternatively the factory could redirect `this` to the
subclass at call time (e.g., not `.bind(config)`), which would honour
`this.toIdentifier` polymorphism — but that would break the
sibling-in-same-File guarantee that the multi-Projection pattern
depends on. A skill-level note explaining "why subclasses share the
base's exportPath" would be high-leverage; the design isn't a bug, it
just isn't surfaced anywhere.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** open — verified against `core/dsl/operation/oas/toOasOperationProjectionBase.ts:52-53`: the misleading comment is NOT in core; it lives in `gen-shadcn-form/src/base.ts` (the generator-side, not the SDK factory). Fix target is generator-side; not yet applied. The SDK factory's `.bind(config)` semantics are deliberate (sibling Definitions share a File), so the core code is correct — only the consumer-generator's comment needs rewriting.

---

### 2. Projection-wrapper `register` auto-fills destinationPath; Snippet `register` requires it [friction]

Refactoring `FormStateType` and `PathParamsHook` from Snippets to
Projections, both files have `this.register({ imports, destinationPath })`
calls.

**What happened:** I left the existing `destinationPath: settings.exportPath`
arg in place when promoting the Snippets. TypeScript:

```
TS2353: Object literal may only specify known properties, and
'destinationPath' does not exist in type 'BaseRegisterArgs'.
```

Looking at `OasOperationProjectionBase.register(args)` (which is what
the Projection-form inherits), it does *not* accept a `destinationPath`
field — it auto-fills from `this.settings.exportPath`. The Snippet form
of `register` (on `SnippetBase`) *does* accept `destinationPath` because
Snippets have no `settings`.

**What was expected:** symmetric APIs. Either both accept the
destinationPath (Projection ignoring it because it has its own), or
both require it.

**Why it matters:** this is an asymmetry between the Snippet and
Projection-wrapper register methods that you only learn by typecheck
error. When the same code structure works for one variant and not the
other, the friction shows up at the worst moment — right after a
refactor — and the error message (`destinationPath does not exist in
type 'BaseRegisterArgs'`) hints at a type-shape mismatch but doesn't
explain *why* the type shape differs.

The skill's "Where should generated string content go?" decision tree
(§5) mentions `this.register({ imports, destinationPath })` as the
import-registration primitive — it doesn't differentiate the Snippet
and Projection forms. The Snippet scaffold (§6E) DOES show
`destinationPath` as a Snippet constructor arg, and the Projection
scaffold (§6B) shows `this.register({ imports: {...} })` without
destinationPath — but the asymmetry isn't called out.

**Possible fixes:** unresolved. Could be a single normalized
signature where Projection-base's register ignores an unused
destinationPath (lossy but symmetric). Could be a row in the skill's
operational principles table: "Projection wrappers auto-fill
`destinationPath` from `settings.exportPath`; Snippets require it
passed in." A type-system fix that branded the two register methods
distinctly would catch the wrong-direction usage before runtime.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** partially addressed 2026-05-13 — docs cure landed in `reference/api/projection-bases.md` § register is overridden on Projection bases — the signature is different from SnippetBase, with mechanical explanation: `BaseRegisterArgs` (Projection-side, no `destinationPath`) vs `RegisterArgs` (Snippet-side). Surfaces the TS2353 as the refactor signal. Also rippled fixes through `skmtc-generator` SKILL §3 helper table, anti-pattern examples, and verification checklist. **SDK-level prevention (rename `BaseRegisterArgs` → `OwnFileRegisterArgs`, or unify under one signature) is not landed** — proposed in the prevention plan but requires a separate PR. Verified against source: `core/context/generateTypes.ts:138` defines `BaseRegisterArgs` (no `destinationPath`), `OasOperationProjectionBase.ts:141` overrides `register` to take it.

---

### 3. Projection constructor signature is fixed at `{context, operation, settings}` — Projections must be self-contained [friction]

Designing `FormValuesType` as a Projection. The original Snippet form
took `{ context, tsBodyTypeName, visiblePropertyNames }` — precomputed
data from the parent.

**What happened:** I initially wrote a Projection constructor with
the same custom args:

```ts
constructor({
  context, operation, settings,
  tsBodyTypeName, visiblePropertyNames
}: OasOperationProjectionConstructorArgs<EnrichmentSchema> & {
  tsBodyTypeName: string
  visiblePropertyNames: string[]
}) { ... }
```

But `OasOperationDriver` constructs Projections with *only* the fixed
shape `{ context, operation, settings }` (line 95-99 of
`OasOperationDriver.ts`). The extra args would never be passed.

Had to redesign: each Projection re-resolves its dependencies via
`resolveBody(operation)`, `validateAllowList(...)`, and
`this.insertNormalizedModel(...)` / `this.insertOperation(...)`. The
duplicate work is cache-idempotent (Driver memoizes by `(name, exportPath)`,
`validateAllowList` is pure), so source-level duplication is runtime-free.

**What was expected:** custom constructor args, similar to a Snippet.

**Why it matters:** the architectural constraint forces a clean
boundary — each Projection is content-addressed by `(operation,
enrichments)`. Given an operation, a Projection can produce its
Definition without any precomputed-data handshake with a parent.
That's what makes cross-generator composability work — *any* generator
can dispatch a peer with the same `(operation, enrichments)` and get
the same Definition.

But the implication isn't obvious from a TS-typing perspective.
`OasOperationProjectionConstructorArgs<E>` looks like an *extensible*
shape (`& { extraField }` should be allowed), and TS will accept the
type — only at runtime do you discover the Driver doesn't pass it.
The error mode is "your extra field is `undefined`," which is
confusing without context.

**Possible fixes:** unresolved. The skill could note this in the
"When to write which" decision tree (§2) — Projections must be
self-contained because the Driver controls construction. Or the
Constructor-args type could be made invariant (no `&`-extension
allowed), forcing the design issue at type-check time. Or the Driver
could thread arbitrary additional context (a `pageContext` field
the parent fills, the Driver passes through) — though that adds
surface area and undoes the content-addressing.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** open — concept not yet codified in `concepts/projections-and-snippets.md` § When to use which. The skill's §2 decision tree doesn't yet call out "Projections must be self-contained because the Driver controls construction." Doc-cure pending. SDK prevention (branding the Constructor-args type as invariant, or threading additional context through the Driver) considered but deferred — current Driver shape is load-bearing for content-addressing.

---

### 4. `isSupported` static-override typing trap when base config didn't specify it [friction]

Adding a capability gate to `PathParamsHook` — should only emit for
operations with at least one path param.

**What happened:** Initial attempt:

```ts
static override isSupported({
  operation
}: IsSupportedOasOperationConfigArgs<EnrichmentSchema>) {
  return !isEmpty(operation.toParametersObject(['path'])?.properties ?? {})
}
```

Three TS errors:

```
TS2417: Class static side 'typeof PathParamsHook' incorrectly extends
        base class static side 'typeof (Anonymous class)'.
```

The factory (`toOasOperationProjectionBase.ts:56`) does:

```ts
static isSupported = config.isSupported ?? (() => true)
```

When the config doesn't supply `isSupported`, the base's static
`isSupported` is typed as `() => true` — a no-arg function. The
subclass override (taking `IsSupportedOasOperationConfigArgs<E>`) is
not assignable to that type — static-method overrides must be
compatible with the base's static shape.

Worked around by extracting a sibling helper function:

```ts
export const hasPathParams = (operation: OasOperation): boolean => {
  const pathParamsObject = operation.toParametersObject(['path'])
  return !isEmpty(pathParamsObject?.properties ?? {})
}
```

Callers invoke `hasPathParams(operation)` before dispatching.

**What was expected:** `static override isSupported(args)` to work like
any other static override.

**Why it matters:** static-method polymorphism in TypeScript has
limits — variance rules at the class-static side are strict. The
issue here is upstream: the base config's `isSupported` is *optional*,
and its inferred type is `() => true` (the fallback) rather than
`(args: IsSupportedOasOperationConfigArgs<E>) => boolean` (the real
contract). If the base config always declared `isSupported` (even as
`() => true`), the inferred type would match the protocol and
subclasses could override it.

The skill has nothing about this — `isSupported` is discussed only at
the entry-config level (§4 anti-patterns), not at the
Projection-subclass-override level. The decision tree §5 doesn't
mention it. The workaround (sibling helper) is fine, but it's
discoverable only after the typecheck error pushes you off the
"natural" path.

**Possible fixes:** unresolved. The factory could *require* the
config to declare `isSupported` (typed correctly), at the cost of
verbosity. Or the type generated for the static could be the union
of `(() => true) | ((args) => boolean)`, allowing both. Or the
skill could call out the sibling-helper pattern as the canonical
escape hatch for "this Projection is conditionally applicable."

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** open — verified against source: `core/dsl/operation/oas/toOasOperationProjectionBase.ts:55` `static isSupported = config.isSupported ?? (() => true)`. The fallback type is `() => true`, not `((args) => boolean) | (() => true)`, so subclass `static override isSupported(args)` hits TS2417. SDK prevention is a one-line fix: type the fallback to match the configured signature (e.g., `static isSupported: NonNullable<typeof config.isSupported> = config.isSupported ?? (() => true)`). Not yet landed; sibling-helper workaround documented in the friction-log entry remains operational.

---

### 5. "File-scope export disguised as Snippet" is a discoverability anti-pattern the skill doesn't name [friction]

Throughout this session: lifting five supplemental exports
(`FormValuesType`, `FormOptionsType`, `FormStateType`,
`FormEmptyValues`, `PathParamsHook`) and then three more
(`FormBody`, `FormBodyPropsType`, `FormPropsType`) from Snippets
registered via `defineAndRegister` to Projections dispatched via
`insertOperation`.

**What happened:** the original `ShadcnFormHook.toString()` and
`ShadcnForm.toString()` produced multi-export strings — the
"hack" pattern. When I first replaced the hack, I lifted each export
to a Snippet + `context.defineAndRegister({ identifier, value, destinationPath })`.
That works correctly — each Definition lands in the File, the
rendered output is the same as the hack — but it's the wrong
primitive.

Snippets-registered-via-`defineAndRegister` for file-scope exports:

- Are NOT addressable by `(name, exportPath)` cache key (the
  identifier is computed at the *caller*, not by the Snippet itself).
- Cannot be reached by other generators via `insertOperation` (no
  cross-generator operation-reference protocol).
- Don't have content-addressed identity — if a future generator
  needs the same `<Foo>FormValues` type, it has to recompute the
  identifier convention rather than calling
  `FormValuesType.toIdentifier(operation).name`.
- Force the caller to own the identifier construction (`Identifier.createType(this.valuesName)`),
  meaning the identifier name lives in two places — the caller and
  the Snippet — drifting on rename.

The skill's §2 decision tree DOES say "file-scope export → Projection."
But this is one rule among many, and the *consequences* of choosing
Snippet+`defineAndRegister` for a file-scope export aren't called out.
You can build the wrong thing, ship it, and never see the cost — until
another generator needs to compose with your output.

**What was expected:** Snippet+`defineAndRegister` and Projection are
two ways to produce file-scope Definitions; both are equally
idiomatic.

**Why it matters:** this is the single most LLM-unique observation
in this session. The Snippet+`defineAndRegister` route looks
attractive because:

- It's less boilerplate per export (~30 lines vs ~80 for a
  Projection).
- The caller-side code is denser ("look, all four supplementals
  registered right here in the parent's constructor").
- The skill's `defineAndRegister` row in §3's helper table says it's
  for "a type alias, a constant" — exactly the role the supplementals
  play.

But the absence of cache-key discoverability is a real cost. The
section that names the operation-reference protocol (§3.5) — the
cross-generator composability mechanism — relies on the producer
generator being a Projection. A Snippet+`defineAndRegister` Definition
is reachable through `findDefinition` (the user could look it up by
the known name string), but not through `insertOperation` (no
projection class to pass).

The pattern: **if a Definition is ever something another generator
might want to reference by name, it should be a Projection.**
"Currently no other generator references it" is not a reason to
choose Snippet, because today's no-consumer becomes tomorrow's
consumer (a test generator, a kit generator, a docs generator). Make
it discoverable from the start.

**Possible fixes:** unresolved. The skill's anti-pattern catalog
(§8) could grow a row: "File-scope export emitted via
`defineAndRegister`-of-a-Snippet rather than as a Projection." With a
worked example: the supplemental exports of a generated form. The
skill's §3 helper table could re-frame `defineAndRegister`'s role as
"sibling Definitions whose identifier is determined at the *caller*"
— so the reader understands when that's appropriate (rare) vs when
it's the wrong primitive (most file-scope exports).

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** verified-fixed 2026-05-13 — anti-pattern codified mechanically in `concepts/projections-and-snippets.md` § Choosing the right primitive — mechanical traps to avoid (the "File-scope export via a Snippet + `defineAndRegister`" sub-section), with the three mechanical reasons: identifier not content-addressed by `(Producer.toIdentifier, Producer.toExportPath)`, unreachable through `insertOperation(Producer, op)` (no Projection class to pass), rename safety against a single `toIdentifier` site rather than the caller-built name string. Mirrored as an operational-principle row in `llms.md`. Skill's §8 anti-patterns section reinforced via the related entries (#6, static-toidentifier#3).

---

### 6. "Snippet parameterized by hardcoded values its sole caller always passes" anti-pattern [friction]

Reviewing `ShadcnFormFooter`'s constructor — user flagged that the
`formIdVar: 'formId'`, `isSavingVar: 'isSaving'`,
`cancelHandlerExpr: 'props.onCancel'`, and `submitLabelExpr: \`props.submitLabel ?? ${...}\``
args were all hardcoded by the sole caller.

**What happened:** the Snippet took five constructor args, four of
which were string literals every caller would pass identically. The
parameterization gave an illusion of generality without delivering
it. After collapsing, the Snippet's signature is `{ context,
submitLabel, destinationPath }` — three args, only `submitLabel`
genuinely varies.

**What was expected:** the parameterization gave reusability or
testability that the inline form wouldn't.

**Why it matters:** this is adjacent to entry #5 (Snippet-as-file-scope-
export) but distinct — about what *fields* a Snippet exposes vs.
hardcodes. The same diagnostic question (`is there one caller? does it
always pass the same value?`) catches both anti-patterns.

The general principle: **parameterize what *actually* varies, not
what *abstractly could* vary.** Each constructor arg has a real
cost:

- It expands the Snippet's call-site verbosity.
- It adds a step of indirection for the reader (param → call site →
  literal).
- It invites mismatched-value bugs (someone passes a different value
  by mistake; nothing catches it because the parameter exists).
- It creates a false signal of generality: "this Snippet supports
  custom variable names!" — except nothing else ever uses them.

The skill's §6 scaffolds and §4 operational principles cover *what
goes through `register`* and *what's a Projection vs Snippet*, but
they don't address *what to expose as a Snippet's constructor
parameter*. That's the missing axis.

**Possible fixes:** unresolved. Skill update: a row in §4 (operational
principles) or §8 (anti-patterns) along the lines of:

> Parameterizing a Snippet by values its sole caller always passes
> identically → inline the values in the Snippet's template; expose
> only what genuinely varies.

Decision rule: "if I imagine a hypothetical second caller, would it
pass a different value here? If no → inline it."

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** verified-fixed 2026-05-13 — codified in `concepts/projections-and-snippets.md` § Choosing the right primitive — mechanical traps to avoid (the "Snippet over-parameterized with sole-caller hardcoded values" sub-section), framed as API-design debt (not a framework-invariant break) distinct from the other two anti-patterns. The diagnostic question ("would a hypothetical second caller pass differently?") is preserved on the doc. Mirrored as an operational-principle row in `llms.md`.

---

### 7. Self-contained Projections via cache-idempotent dispatch — same-File composition is free at runtime [win]

Building nine Projections that share a File (form values type,
options type, state type, empty values, [path-params hook], hook,
body, body-props type, props type, wrapper). Each is dispatched
either from `ShadcnForm`, `ShadcnFormHook`, or transitively from one
of the supplementals.

**What worked:** every Projection re-resolves its own dependencies
in its constructor (`resolveBody`, `validateAllowList`,
`this.insertOperation(Peer, op)`, `this.insertNormalizedModel(Peer, …)`).
The architectural promise — "duplicate work hits the cache; runtime
cost is zero" — held up under nine Projections × ~3 peer dispatches
per Projection.

The dispatch tree at runtime:

```
ShadcnForm.constructor
  insertOperation(ShadcnFormHook)
    insertOperation(TanstackQuery)
    insertNormalizedModel(ZodProjection, body)
    insertOperation(FormValuesType)
      insertNormalizedModel(TsProjection, body)  ← cache miss
    insertOperation(FormOptionsType)
      insertOperation(FormValuesType)             ← cache HIT
      insertOperation(TanstackQuery)              ← cache HIT
    insertOperation(FormStateType)
      insertOperation(FormValuesType)             ← cache HIT
    insertOperation(FormEmptyValues)
      insertOperation(FormValuesType)             ← cache HIT
  insertOperation(FormBody)
    insertOperation(FormBodyPropsType)
      insertOperation(FormValuesType)             ← cache HIT
  insertOperation(FormPropsType)
    insertOperation(FormOptionsType)              ← cache HIT
```

`FormValuesType` is dispatched seven times across the tree. Only the
first runs the constructor; the other six are cache hits returning
the same `Inserted`. The source-level duplication (each constructor
calling `validateAllowList`, `insertOperation(FormValuesType)`, etc.)
felt redundant when writing it, but at runtime it's all coalesced
through `findDefinition({ name, exportPath })` lookups.

**Why it matters:** this is the architecture working as designed.
The skill states this property in §3 ("memoization keyed by
`(identifier.name, exportPath)`") but seeing it absorb genuinely
duplicated-looking code without runtime cost makes the principle
concrete. The lesson: **don't optimize source-level duplication for
runtime; trust the cache.**

There's a secondary lesson about Projection authorship: each
Projection should look like it could be the *only* generator
producing this Definition. Not "this Projection assumes its parent
has already resolved X." Each one stands alone, and the cache
silently dedupes when they don't.

**Possible fixes:** N/A (win) — but worth codifying as a section in
the skmtc-generator skill: "Why each Projection re-resolves its own
deps — and why that's free." Could go in §3 (cross-generator
coordination) or as a new sub-section under "When to write which."

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-shadcn-form@0.0.1`

**Status:** open — the architectural property (Projections are content-addressed by `(operation, enrichments)`, source-level duplication is coalesced through `findDefinition` at runtime) is real but not yet codified as its own section in `concepts/cross-generator-coordination.md` or `concepts/projections-and-snippets.md`. The §3 helper table in the `skmtc-generator` skill mentions memoization but doesn't show the "duplicate-looking source compiles to coalesced runtime" example. Doc-cure pending.

---

### 8. `Identifier.createVariable(name, typeName?)` carries the typed-const annotation through the Driver [win]

Promoting `FormEmptyValues` from Snippet to Projection. The rendered
output needs to be `export const EMPTY_VALUES: <FooFormValues> = {…}`
— a typed-const declaration.

**What worked:** the type annotation `: <FooFormValues>` comes from
the `Identifier`, not the Snippet/Projection value. Specifically:

```ts
Identifier.createVariable('EMPTY_VALUES', valuesTypeName)
```

The second arg is the typeName. `Definition.toString()` (line 233-244)
composes the output as:

```ts
const identifier = this.identifier.typeName
  ? `${this.identifier.name}: ${this.identifier.typeName}`
  : this.identifier.name

return `${noExport ? '' : 'export '}${this.identifier.entityType} ${identifier} = ${this.value};`
```

So the Projection's `toString()` returns ONLY the RHS (the object
literal). The Driver wraps it with `export const`, the identifier,
and the type annotation — all from the Identifier.

In `FormEmptyValues.toIdentifier()`:

```ts
static override toIdentifier({ operation, enrichments }) {
  const valuesTypeName = FormValuesType.toIdentifier({ operation, enrichments }).name
  return Identifier.createVariable('EMPTY_VALUES', valuesTypeName)
}
```

The annotation target (`valuesTypeName`) is computed by asking
`FormValuesType` for *its* identifier name. Each Projection owns its
identifier convention; the consumer reads it via the static method.
Zero string-formula duplication across Projections.

**Why it matters:** before reading `Definition.toString()`, I was
about to write `this.valuesName` into `FormEmptyValues.toString()`
to produce `<FooFormValues>` text in the value — duplicating the
type annotation responsibility between the Identifier and the
value. Almost wrote bad code. The right model: **the Identifier
owns *naming* concerns (entityType, name, typeName annotation); the
Projection/Snippet value owns *content* concerns (the RHS expression).**

This clarifies a wider principle. For each rendered declaration:

| Concern | Owner |
|---|---|
| `export ` prefix (or skip) | Identifier's noExport |
| `const` vs `type` vs `function` | Identifier's entityType |
| Identifier name | Identifier.name |
| Type annotation (`: X`) | Identifier.typeName |
| RHS expression (`= …`) | The wrapped value (toString) |

When you're writing a Projection or Snippet, the question "what does
my toString return?" has a clean answer: only the RHS.

**Possible fixes:** N/A (win) — but the skill's §5 decision tree
("Where should generated string content go?") could add a row:

| Concern | Where |
|---|---|
| ... | ... |
| Typed-const annotation | `Identifier.createVariable(name, typeName)` (NOT in the value's toString) |
| `export type` vs `export const` | `Identifier.createType(name)` vs `Identifier.createVariable(name)` |

Currently the decision tree mentions `Identifier.createVariable(name)`
and `Identifier.createType(name)` but doesn't show that the typeName
second-arg threads through `Definition.toString()` automatically.
That's the load-bearing detail.

**Version anchor:** `@skmtc/core@0.4.4`

**Status:** open — the load-bearing detail (typeName threads through `Definition.toString()` automatically, so `toString()` returns only the RHS) is not yet codified in the `skmtc-generator` skill's §5 decision tree or in `concepts/projections-and-snippets.md`'s composition table. Doc-cure pending.
