# 2026-05-13 — GraphQL generator friction

Session worked through `BULK-021` in the discrepancy catalog: the cross-package coupling between `@skmtc/gen-graphql-operation` and `@skmtc/gen-graphql-typed-document-node`. The investigation surfaced several structural smells beyond the headline anti-pattern. By session end both packages had been deleted from the workspace. Entries below capture observations from that arc with an eye to applicability across the rest of `skmtc-generators/`.

## Index

| # | Entry | Severity | Status |
|---|-------|----------|--------|
| 1 | `.generated.ts` files cannot contain "fill-in-the-blank" output | friction | open |
| 2 | Thin-wrapper-mistaken-for-generator: when delegation exceeds distinctive logic | friction | open |
| 3 | Cross-package brand-type incompatibility forces `--no-check` on publish | friction | open |
| 4 | Config flags for binary feature toggles conflict with clone-to-customize | friction | open |
| 5 | Zero-consumer audit as a deletion playbook | win | open |
| 6 | Driver-mediated insertion + `Inserted.toName()` does work most authors would do by hand | win | open |
| 7 | Multi-iteration refactor pattern: each step a real improvement, deeper smell visible from the start | polish | open |
| 8 | The cross-package import in a deprecation shim is the same anti-pattern in miniature | friction | open |

---

### 1. `.generated.ts` files cannot contain "fill-in-the-blank" output [friction]

Observed in the (now-deleted) `GraphqlOperationDocument` Projection. Its `buildStub` helper produced GraphQL like:

```graphql
query GetUser($id: ID!) {
  getUser(id: $id) {
    # TODO: select fields
  }
}
```

wrapped in `gql\`...\`` and assigned to `<Base>Document: TypedDocumentNode<Result, Args>`.

**What happened:** For any composite return type (almost all real-world GraphQL APIs), the emitted document is **invalid at runtime** — a GraphQL server responds with `"Field 'getUser' must have a selection of subfields"`. The `# TODO: select fields` placeholder is a GraphQL comment, not a valid selection set. The only way to make the file work is for the consumer to hand-edit it — but the file is `.generated.ts` and gets overwritten on every `skmtc generate`.

**What was expected:** by training-data instinct, scaffold output gets used as a starting point and edited. SKMTC's `.generated.ts` convention inverts this: generated files are pure, regenerable artifacts the consumer never touches.

**Why it matters:** the friction is GraphQL-specific in its surface form but **the general rule is broader**: stock generators should never emit output that requires consumer hand-editing inside `*.generated.ts`. The two viable shapes are (a) emit complete, working output and (b) don't emit that piece at all and let the consumer wire it up in their own non-generated code. The "scaffold a stub" middle ground breaks the regenerate cycle silently — consumer edits get wiped, and they may not notice until production. The same trap could appear in any generator that "almost knows what to emit but needs the consumer to fill in the last bit": form generators with `// TODO: validation here`, mock generators with placeholder response bodies, etc. Audit existing stock generators for this pattern.

`gen-reapit-graphql-client` (the real-world GraphQL hook generator in the workspace) sidesteps this entirely with its `src/selection/` module — it generates complete documents with real selection sets derived from the schema. That's the demonstration that "real" GraphQL generation is doable; the stub approach was a half-measure.

**Possible fixes:** for the GraphQL-operation case specifically, the package was deleted, so the immediate problem is gone. As a general check: grep stock-generator output for `TODO`, `FIXME`, or placeholder strings in `.generated.ts` templates, and treat any hit as a structural review item.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-graphql-operation@0.0.59` through `0.0.63` (all deleted)

**Status:** open

---

### 2. Thin-wrapper-mistaken-for-generator: when delegation exceeds distinctive logic [friction]

`@skmtc/gen-graphql-operation` was a "stock GraphQL operation generator" that, on tracing its actual responsibilities, turned out to be a ~30-line TypeScript-naming-and-pathing adapter wrapping `TsProjection`.

**What happened:** four routing cases in its transform — three of them (`rich args`, `inline result`, `ref result via TsProjection`) delegated emission to `TsProjection.insertNormalizedModel`. The fourth (empty args) emitted a literal string `'Record<string, never>'`. Distinctive logic the package actually owned:

- A naming convention: `<Base>Args`, `<Base>Result`
- An export path: `@/gql/operations/<rootKind>_<fieldName>.generated.ts`
- A ref-result alias layer (`type <Base>Result = ReferencedType`)

No GraphQL-specific TypeScript emission. No scalar mapping. No nullability handling. No schema walking. The package shipped 63 published versions and had zero `.ts` consumers across the entire workspace, including the one real GraphQL-hook generator (`gen-reapit-graphql-client`), which rolled its own.

**What was expected:** I assumed a "GraphQL operation generator" would have substantial GraphQL-specific emission logic that justified its package boundary. Reading the source revealed mostly thin delegation.

**Why it matters:** the pattern generalises. **When a generator's distinctive logic is "naming convention + export path + delegation to a peer generator," the package boundary is probably not earning its keep.** Candidate generators worth auditing under this lens:

- Anything whose `transform` is dominated by `context.insertNormalizedModel(TsProjection, ...)` or `context.insertNormalizedModel(ZodProjection, ...)` calls
- Anything whose `mod.ts` is <40 lines of routing
- Anything pinned by other packages but never imported in code (a "no real consumers" signal)

The corollary: when designing future generators, ask "is the abstraction I'm building actually general enough to outlive its first consumer?" Reapit's GraphQL generator demonstrates the test: it had different needs on every axis (naming, paths, response wrapping, document strategy, hook integration) than the proposed shared substrate. The shared substrate `TsProjection` was what BOTH actually used; the proposed shared substrate `gen-graphql-operation` was what neither did.

On the OAS side, there's no `gen-oas-operation` providing "shared request/response types" — every higher-level generator (gen-tanstack-query-*, gen-shadcn-form, gen-msw, gen-express) handles its own typing inline via `TsProjection.insertNormalizedModel`. That's evidence the right substrate already exists; layering a thin GraphQL equivalent on top would have repeated the same mistake.

**Possible fixes:** unresolved — the package was deleted, but the general pattern (thin wrapper with naming convention only) could appear elsewhere. Worth a periodic "trace each generator's transform and tally how many lines do real emission vs delegation" exercise.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-graphql-operation@0.0.1` through `0.0.63` (deleted)

**Status:** open

---

### 3. Cross-package brand-type incompatibility forces `--no-check` on publish [friction]

Hit this on every publish of `gen-graphql-operation` (and confirmed in `gen-graphql-typed-document-node`'s publish task and the cli/server packages too).

**What happened:** `deno publish` runs a type-check using JSR-resolved imports (not workspace-local). At that resolution, `context.insertNormalizedModel(TsProjection, ...)` fails type-checking with:

```
Type 'typeof TsProjection' is not assignable to parameter of type 'ModelProjection<GeneratedValue, undefined>'.
  Type '`${string}|${string}|get` & { [brand]: "OasOperationGeneratorKey"; }' is not assignable to type 'GeneratorOnlyKey'.
    Property '[brand]' is missing in type 'String & { [brand]: "OasOperationGeneratorKey"; }' but required in type '{ [brand]: "GeneratorOnlyKey"; }'.
```

The brand-type discriminator on `TsProjection.prototype.generatorKey` (resolved through JSR) doesn't match what the `ModelProjection` signature in `@skmtc/core` expects. The fix in the codebase is **`--no-check`** in the publish task, matching what `cli/deno.json` and `server/deno.json` already do.

**What was expected:** local `deno check` passed clean. Publish should pass too.

**Why it matters:** the workaround papers over a real type-level bug — `GeneratorKey` brand variants in `@skmtc/core` don't compose with the way Projection classes declare their `generatorKey` field. The same incompatibility silently affects every generator that calls `insertNormalizedModel(TsProjection, ...)`. The cost is hidden behind `--no-check`, so authors don't realise their published packages skip type validation entirely. Every new generator package in `skmtc-generators/` has to either (a) hit this error and discover the workaround themselves or (b) be told about it ahead of time.

Two related concerns:

1. **`--no-check` masks future, unrelated type errors.** A real bug introduced in generator code wouldn't be caught at publish; only consumers running their own `deno check` would notice.
2. **The brand-type bug itself is fixable at the `@skmtc/core` level.** Either widen the `ModelProjection` signature to accept the variant brands, or rework the `GeneratorKey` discriminator so all variants compose. Not yet investigated.

**Possible fixes:** unresolved. Short-term: document the workaround in `skmtc-generator` skill so new authors don't lose cycles. Medium-term: trace the brand-type definitions in `core/dsl/GeneratorKeys.ts` and the Projection signatures in `core/dsl/model/types.ts` / `core/dsl/operation/oas/types.ts` to find a unifying shape. Long-term: drop `--no-check` from publish tasks once the upstream type composes.

**Version anchor:** `@skmtc/core@0.4.4`, `@skmtc/gen-typescript@0.0.57`, observed during publish of `@skmtc/gen-graphql-operation@0.0.59-0.0.63`

**Status:** open

---

### 4. Config flags for binary feature toggles conflict with clone-to-customize [friction]

When I merged `gen-graphql-typed-document-node` into `gen-graphql-operation`, my first move was to add a `toGraphqlOperationEntry({ emitDocument?: boolean })` factory — preserving the old two-package "choose your shape" affordance at the config layer.

**What happened:** the user flagged the flag as anti-pattern by SKMTC's clone-to-customize philosophy ([[project_skmtc_clone_to_customize]]). The framework's customization seam is **cloning the generator source and editing it**, not toggling features via config. Stock generators ship one opinion; consumers who want a different opinion clone and modify.

**What was expected:** my training-data instinct is that "make optional features configurable" is the polite, user-respecting API design. In SKMTC that instinct is wrong.

**Why it matters:** the rule cleaves "parametric config" from "feature toggle" in a way that's easy to miss:

- **Parametric config is legitimate** — e.g., `toTypescriptEntry({ scalars: {...} })`. Each consumer's API has different scalar names; the values can't be hardcoded because they vary per input. The shape of the configuration is the same across consumers; only the values differ.
- **Binary feature toggles are anti-pattern** — e.g., `toGraphqlOperationEntry({ emitDocument: true })`. The "should this generator emit X" decision is exactly the kind of decision the generator's authored opinion encodes. Consumers who want X clone and add it; consumers who don't want X clone and remove it.

The first-pass test: "would two consumers of this package set the flag to different values, OR are we essentially trying to ship two slightly different generators in one package?" If the latter, it's two opinions pretending to be one configurable generator. Clone-to-customize handles this naturally — and avoids the dead-code path the flag-off case ships to every consumer.

This is GraphQL-flavoured friction but applies anywhere. Any time a new stock generator considers a `boolean` config field, run that test.

**Possible fixes:** unresolved. The `emitDocument` flag was removed; the Document Projection was eventually deleted entirely. The general check is the test above — possibly add it to the `skmtc-generator` skill's authoring principles.

**Version anchor:** `@skmtc/gen-graphql-operation@0.0.60` (intermediate state, since removed)

**Status:** open

---

### 5. Zero-consumer audit as a deletion playbook [win]

This session deleted two packages — `@skmtc/gen-graphql-typed-document-node` and then `@skmtc/gen-graphql-operation` — using the same procedure each time.

**What happened:** before either deletion, ran a structured audit:

```bash
# .ts/.tsx imports anywhere in the repo (excluding the package itself)
grep -rln "@skmtc/<package>" --include="*.ts" --include="*.tsx" | grep -v "<package>/"

# User project consumption
find . -path "*/.skmtc/*/deno.json" -exec grep -l "<package>" {} \;

# Other generators' deno.json pins (pinned but unused is a different signal)
grep -rln "<package>" skmtc-generators/*/deno.json | grep -v "<package>/"
```

For both packages: zero `.ts` consumers, zero user-project consumers, the only "consumer" was a pin in another generator's `deno.json` that the generator never actually imported in code. The CLI smoke test was the sole code consumer, easily swapped to a different fixture.

**Why it matters:** deletion in a published-package context is high-anxiety — "what if someone is using it?" The zero-consumer audit converts the decision from gut-feel to evidence. The procedure is mechanical, fast (~30 seconds), and conservative (it pessimistically counts pins in `deno.json` files even when no code imports the package).

The pattern is repeatable beyond GraphQL: any time a stock generator's role is in doubt, run the audit. Three outcomes:

- **Multiple real `.ts` consumers** → keep, the package is earning its boundary
- **Zero real consumers, some pins in unused deps** → audit the pinning packages (they often dropped the import but left the pin)
- **Zero of either** → safe to delete; existing published versions remain on JSR for any pre-existing installs

Combined with [[feedback_skmtc_generator_location_independence]], this gives a complete deletion decision flow: identify a candidate via the "thin wrapper" / "cross-package coupling" / "pair with X" smells, then run the audit to confirm zero consumers, then delete with one PR touching the workspace `deno.json` and downstream pins.

**Version anchor:** procedure used against `@skmtc/gen-graphql-typed-document-node@0.0.60` and `@skmtc/gen-graphql-operation@0.0.63`

**Status:** open — worth codifying in the `skmtc-generator` or `skmtc-cli` skill as the canonical "should we delete this generator?" playbook

---

### 6. Driver-mediated insertion + `Inserted.toName()` does work most authors would do by hand [win]

After collapsing the merged package to a single root Projection (`GraphqlOperationDocument` extending `GraphqlOperationBase`), the constructor's routing logic was strikingly short:

```ts
constructor(args: GqlOperationProjectionConstructorArgs) {
  super(args)
  const { operation } = args
  const name = GraphqlOperationBase.toIdentifier({ operation, enrichments: undefined })

  const argsObject = synthesizeArgsObject(operation)
  if (argsObject !== undefined) {
    this.insertNormalizedModel(TsProjection, {
      schema: argsObject,
      fallbackName: `${name}Args`
    })
  } else {
    this.insertOperation(GraphqlOperationArgs, operation)
  }
  // ... result branch, then this.register({ imports: ... })
}
```

**Why it matters:** the pre-refactor version of the same logic (free-function `emitOperation` + `emitResult` calling `context.register({ definitions: [new Definition({...})] })` with hand-built `generatorKey` values) was ~80 lines of boilerplate doing what `this.insertModel` / `this.insertOperation` / `this.insertNormalizedModel` did in 1-line calls. The Driver handles:

- Per-(operation × generatorId) cache key computation (no more `toGeneratorOnlyKey({ generatorId: id })` calls)
- Cross-generator collision detection via `affirmDefinition` (loud `Registered definition mismatch` errors instead of silent first-write-wins)
- Auto-registration of imports into the calling Projection's file (no more `register({ imports: { [targetPath]: [targetName] } })`)
- Idempotent re-insertion (the same Projection inserted twice for the same operation returns the cached instance)

Each of these is work an author would otherwise do by hand, with high risk of getting one of them wrong. The Driver path is shorter AND safer AND idiomatic. The lesson: **when a generator author finds themselves calling `context.register({ definitions: [new Definition(...)] })` directly, that's a strong signal there's an `insertX` method that does the same thing better**. The same applies to manual import registration via `register({ imports })` — `this.insertModel(PeerProjection, refName)` auto-registers the import for free.

Possibly worth a side-by-side example in the `skmtc-generator` skill or the `compose-with-another-generator` how-to: "what manual `register` looks like" vs "what the Driver-mediated equivalent looks like" with the line-count comparison.

**Version anchor:** observed during refactor of `@skmtc/gen-graphql-operation@0.0.58` (pre-refactor `emit*` shape) → `@skmtc/gen-graphql-operation@0.0.62` (Driver-mediated shape, since deleted)

**Status:** open — pattern worth codifying

---

### 7. Multi-iteration refactor pattern: each step a real improvement, deeper smell visible from the start [polish]

Over this session, `@skmtc/gen-graphql-operation` shipped versions `0.0.59`, `0.0.60`, `0.0.61`, `0.0.62`, `0.0.63` and was then **deleted entirely**.

**What happened:** each version was a genuine improvement (Driver/Projection refactor → package merger → single factory base → minimal Entry mod.ts → private helpers), but each was prompted by the user pointing out a deeper issue I'd missed on the previous pass. By the time we'd reached `0.0.63`, the package looked structurally clean — and that's when the underlying question surfaced: "is this package actually used?" The answer was no, and deletion followed.

**Why it matters:** the deeper architectural question ("does this package earn its boundary?") was answerable from the very first observation that gen-graphql-operation was a thin TypeScript-naming wrapper. But the refactor track took precedence over the existence question for five iterations. **A "fix the structure" reflex can defer "does this thing belong?" indefinitely.**

Two diagnostics that would have surfaced the deletion candidate earlier:

1. **The zero-consumer audit** (entry 5). Running it before the refactor track started would have flipped the conversation to "delete or keep" rather than "refactor how."
2. **The "what is this generator's distinctive logic?" question** (entry 2). Tracing the routing once would have surfaced that 3 of 4 cases were TsProjection delegation.

Neither check takes more than a couple of minutes. Both should be earlier moves in any generator audit, before structural refactors get traction.

**Possible fixes:** unresolved. Possibly add a "before refactoring an existing generator, run the consumer audit + delegation trace" checkpoint to the `skmtc-generator` skill.

**Version anchor:** observed across `@skmtc/gen-graphql-operation@0.0.59` through `0.0.63`

**Status:** open

---

### 8. The cross-package import in a deprecation shim is the same anti-pattern in miniature [friction]

After merging `gen-graphql-typed-document-node` into `gen-graphql-operation`, my first instinct was to keep `gen-graphql-typed-document-node` alive as a deprecation shim:

```ts
import { toGraphqlOperationEntry } from '@skmtc/gen-graphql-operation'

export const graphqlTypedDocumentNodeEntry = toGraphqlOperationEntry({
  emitDocument: true
})
```

**What happened:** the user pointed out this is the **same cross-package coupling pattern in miniature**. The shim imports across the package boundary specifically to preserve a backward-compatibility surface for consumers who don't exist (zero-consumer audit confirmed this immediately afterward). The shim was deleted.

**Why it matters:** the impulse to preserve backward compatibility is reflexive, but in a context with no real consumers it's a net cost:

- **Maintenance overhead** — every future `@skmtc/core` bump means republishing the shim to repin core, for zero observable benefit.
- **Documentation gravity** — as long as the deprecated package exists, doc references to it keep accumulating, search results keep surfacing it, and AI agents reading the docs keep recommending it. Deletion forces a clean rewrite.
- **The shim itself is structurally the anti-pattern it deprecates** — cross-package import knowledge between two SKMTC packages, just thinner.

Generalisable rule: **a deprecation shim with zero real consumers is not a kindness; it's debt.** The zero-consumer audit (entry 5) is the deciding factor — if there are no consumers, skip the shim and go straight to deletion. Published versions on JSR remain immutable for anyone with an existing pin; that's the only backward-compatibility surface needed.

**Possible fixes:** unresolved. Possibly worth a checkbox in the deletion playbook: "did the consumer audit find ≥1 real consumer? If no, skip the shim."

**Version anchor:** `@skmtc/gen-graphql-typed-document-node@0.0.60` (the shim version, since deleted)

**Status:** open
