# Design philosophy

> The principles that generate SKMTC's design choices — what we value, what we refuse, what we trade.

## The core bet

[One-paragraph essence statement summarizing the four most load-bearing principles: clone-to-customize, idempotency by construction, lenient parsing with strict diagnostics, and output as source code rather than a runtime library. The paragraph should be re-quotable on its own.]

## The principles

Each principle is **contestable** — a choice SKMTC makes that another reasonable codegen tool makes differently. If a claim could equally describe orval, kubb, OpenAPI Generator, and graphql-codegen, it isn't load-bearing for SKMTC and isn't here.

### 1. Clone-to-customize, not configure-to-customize

> Customization lives in source code you own, not in configuration flags you set.

#### What it means in practice

#### Consequences

- No plugin API beyond enrichments (per-instance config that doesn't touch behavior)
- Stock generators are intentionally small and opinionated; hardcoded values are *the customization seam*
- The license split (MIT for stock generators, Apache 2.0 for engine) reflects this
- Stable APIs in `@skmtc/core` are critical because cloned generators depend on it directly
- Customization discoverability is by code reading, not by docs lookup

#### Deeper discussion

See [Why clone-to-customize](why-clone-to-customize.md).

### 2. Idempotency by construction, not by maintenance

> Cross-generator coordination is memoization keyed by `(identifier.name, exportPath)`, where both are pure functions of input. Generator order doesn't matter because the system can't allow it to matter.

#### What it means in practice

#### Consequences

- No dependency graph between generators; no topological sort
- No "plugin order" config
- Two runs of the same generators against the same schema produce byte-identical output (modulo external formatters)
- Generators can be written, tested, and reasoned about in isolation

#### Deeper discussion

See [How idempotency works](how-idempotency-works.md).

### 3. Lenient input, strict diagnostics

> One bad schema doesn't kill the run. Downstream generators receive a smaller-than-expected document. Diagnostics are exhaustive even when output is partial.

#### What it means in practice

#### Consequences

- `tryParseAt` wraps every per-item parser; throws become `ParseIssue`s
- `removeErroredItems` cascade-prunes dependents of failed refs
- Type-inference fallbacks for schemas missing `type` (with warnings)
- Manifest records every issue; exit code derives from issue levels, not from process throws

#### Deeper discussion

See [Error handling philosophy](../concepts/error-handling-philosophy.md).

### 4. Output as source code, not a runtime library

> SKMTC ships nothing at runtime. Generated TypeScript is committed to the consumer's repo and lives like any other source code.

#### What it means in practice

#### Consequences

- Drift between schema and output is detectable via `git diff`
- Generated code can be code-reviewed, refactored, grep-searched
- Upgrade workflow is "regenerate," not "bump a library version"
- The bundle/worker stays inside the build pipeline; nothing crosses into the consumer's bundle

#### Deeper discussion

[Cross-reference to a `recipes/` or `concepts/` doc when written.]

### 5. TypeScript-native templates, not template files

> Templates are template literals inside TS classes, composed with `${...}` interpolation. No Mustache, Handlebars, or EJS.

#### What it means in practice

#### Consequences

- Type safety on interpolated values; full IDE refactoring support
- Generator authors must read and write TypeScript
- `Stringable` is the universal composition interface
- No runtime template engine; no separate parser to maintain

#### Deeper discussion

See [Projections and Snippets](../concepts/projections-and-snippets.md).

### 6. Build on the substrate, don't rebuild it

> Deno is the platform: `deno bundle` is the bundler, `new Worker(...)` is the sandbox, Deno permissions are the access control. SKMTC adds the codegen logic.

#### What it means in practice

#### Consequences

- The engine is small because most platform-level concerns are delegated
- Generators run sandboxed by virtue of Deno Worker permissions, not bespoke isolation
- JSR (Deno's registry) is the distribution channel for generators
- The project is Deno-locked (acceptable; the platform delegation pays for it)

#### Deeper discussion

See [The worker runtime](../concepts/the-worker-runtime.md) and [The GraphQL asymmetry](the-graphql-asymmetry.md).

### 7. Types and runtime validators stay in lockstep via compile-time drift checks

> Every TS union with a paired Valibot schema gets a compile-time
> binding that fails if the two diverge. Adding a variant to one
> without the other is a type error.

SKMTC uses Valibot for runtime validation of the manifest, parse
issues, settings, and generator configs. Each Valibot schema has
a TypeScript counterpart (a discriminated union or literal type)
that consumers narrow against. The two must agree — a runtime
schema rejecting a value the TS type permits is a silent corruption
of the manifest contract; the reverse is dead branches in code.

The pattern: an unread binding asserts the schema satisfies the
type.

```ts
// core/context/generateTypes.ts:208-209
const _oasIssueTypeDriftCheck: v.GenericSchema<OasIssueType> = oasIssueType
void _oasIssueTypeDriftCheck
```

The `_oasIssueTypeDriftCheck` variable is never read. Its only
purpose is to fail compile if `OasIssueType` (the TS union) and
`oasIssueType` (the Valibot schema) drift. Adding a variant to
one without the other produces a type error at this line.

#### Where it appears

- `OasIssueType` ↔ `oasIssueType` (`generateTypes.ts:208-209`)
- `GqlIssueType` ↔ `gqlIssueType` (`ParseIssue.ts:72-73`)
- The Manifest schema and its TS counterparts
- The Settings schema and its TS counterparts
- The Preview / Mapping source-descriptor unions

#### What this means for contributors

An "unused" `_driftCheck` binding is not unused. Removing one
breaks the contract that lets the manifest validate. AI agents in
particular are prone to "tidying up" unused bindings; the comment
on each `_driftCheck` calls out the role to discourage that.

When adding a new variant to a Valibot schema *or* to the TS type
it pairs with, look for the drift-check binding and update both
sides. The compile error at the drift-check line is the surface
that catches the omission.

#### Consequences

- Manifest validation cannot silently corrupt — schema and type
  stay aligned.
- New issue types, settings fields, or preview kinds need
  coordinated edits to both sides (small friction, big payoff).
- Reading SKMTC code, expect to see paired `someType` (TS) /
  `someTypeSchema` (Valibot) / `_someTypeDriftCheck` (unread
  binding) trios. The trio is the unit.

### 8. Primitives bundle their side effects, on purpose

> Every cross-Projection primitive — `insertOperation`, `insertModel`,
> `insertNormalizedModel` — bundles four things into one call: name
> retrieval, producer construction on cache miss, Definition
> registration at the producer's `exportPath`, and cross-File import
> registration on the consumer's File. The bundling is the design;
> separating the steps is what produces silent drift.

#### What it means in practice

A consumer that needs a peer's identifier name doesn't compute it from
scratch — it calls `insertOperation(Producer, op)`. That single call
constructs the producer on cache miss, registers its `Definition`
into the producer's target `File`, registers the cross-File import on
the consumer's `File`, and returns the producer's name via `.toName()`.
All four happen synchronously inside the Driver before the call
returns.

The contrast is the "pure" name lookup, `Producer.toIdentifierName(...)`.
It exists and returns the same string. SKMTC ships it because some
callers — for example, static methods on a *consumer's* own Projection
class, where `this` doesn't exist — have no constructor to
side-effect through. But the pure call does *only* the name
computation. Substituting it for `insertOperation` produces emitted
code that references a name no `File` exports (no Definition
registered), or a name with no matching import line (no import
registered), or a name that hasn't been initialized at module-load
time (`Cannot access 'X' before initialization`, from arbitrary
serialization order within a single File).

Mechanical details of each failure mode: see
[cross-generator-coordination § Why call `insertOperation` instead of `Producer.toIdentifier(op).name`?](../concepts/cross-generator-coordination.md#why-call-insertoperation-instead-of-producertoidentifiernameop).

#### Consequences

- API surface biases toward bundled-side-effect calls. Pure name
  lookups exist but aren't the default; the verification checklist in
  the `skmtc-generator` skill calls out `insertOperation` as the
  default for cross-Projection composition.
- `OasOperationDriver`, `ModelDriver`, and `GqlOperationDriver` own
  the bundling. The same Driver computes the cache key, runs the
  Projection constructor on miss, registers the Definition, and
  registers the import.
- Skipping the bundled call has no compile-time signal — the types
  permit `Producer.toIdentifierName(...)` everywhere it's syntactically
  valid. Discipline has to be taught. The failure mode surfaces only
  at consumer-app build time, or — for the order-of-initialization
  case — at consumer-app runtime.

#### Deeper discussion

The trade-off is discoverability against purity. A purely functional
surface — `getName(op)`, `getExportPath(op)`, `getImports(op)`,
`registerDefinition(...)` — would give the same power but require the
author to remember every step. SKMTC bundles the steps because the
commonly-needed combination is "name plus the side effects that make
the name resolve at render time," and a single call eliminates a
class of bugs where one of the four steps is forgotten.

## Tradeoffs accepted

Each principle has a cost. These are the costs SKMTC accepts to get the properties above. Naming them explicitly so contributors and AI assistants can recognize when a principle is being tested.

### Configurability ceiling

Simple changes that would be config-flag-sized elsewhere require cloning. Friction for users whose needs diverge slightly from stock.

### Clone copy costs

Cloned generators don't auto-receive upstream improvements. Users must merge updates manually or accept divergence. The friction is the cost of the fork-friendly model.

### Higher generator-author barrier

TypeScript-native templates raise the bar vs Mustache. Designers and product managers can't edit templates directly.

### No incremental builds

Each generate is from cold. Acceptable at typical schema sizes (hundreds of operations). Would hurt at very large schemas (10K+ operations).

### Format is the consumer's problem

SKMTC produces valid but unformatted TypeScript. Consumers need a formatter step (pre-commit hook, build script).

### Workers can't reach the network

Some integrations (remote schema fetch at generate time, telemetry, license checks) would benefit from network access. SKMTC chooses safety.

### Documentation cost of cloneable generators

Generic stock-generator docs don't fully apply to clones. Each clone is potentially different from upstream. Documentation has to acknowledge the gradient.

## How the principles compose

When principles pull against each other, which wins.

### Lenient parsing vs reproducible builds

Lenient parsing means partial output. **Resolution:** same input → same partial output (still deterministic). Downstream generators handle smaller documents defensively.

### Clone-to-customize vs upgrade discipline

Cloned generators diverge from upstream. **Resolution:** clones are explicit forks; lockfiles + JSR specifiers handle stock; manual coordination handles clones.

### Idempotency vs cross-generator interaction

Memoization enforces order-independence, but means generators can't reach into each other's bodies. **Resolution:** coordination is by *name*, not source text. Generators ask for what they need via `insertOperation` and use the returned identifier; they don't read the peer's `toString()`.

### Customization depth vs API stability

Cloned generators depend on `@skmtc/core` directly. **Resolution:** `@skmtc/core` treats breaking changes as serious. Apache 2.0 license signals the contributor-friendly intent.

## Alternatives considered and rejected

Each rejection is a load-bearing decision that contributors might propose to reverse.

### Plugin API with `before` / `after` hooks

Rejected: cloning serves the same need without a permanent maintenance surface.

### Mustache-style template engine

Rejected: TypeScript-native composition wins on refactorability and type safety.

### Runtime library returning typed clients

Rejected: generated source code wins on auditability, zero-runtime-cost, and git-friendliness.

### Incremental compilation

Rejected: complexity exceeds benefit at typical schema sizes; from-cold runs are easier to reason about.

### Unified config schema across all generators

Rejected: per-generator Valibot enrichment schemas keep each generator's surface honest and disable the temptation to add cross-cutting flags.

### A central plugin registry on JSR

Rejected: generators are JSR packages by ordinary means; no registry layer.

## License rationale

The Apache 2.0 / MIT split is intentional, not accidental, and reflects the principles above.

- **Engine and CLI: Apache 2.0.** Patent grant, contributor license requirements. Appropriate for foundational platform code expected to have many contributors and downstream patent-sensitive users.
- **Stock generators: MIT.** Permissive, fork-friendly. Appropriate for templated code actively encouraged to be cloned and modified.

The asymmetry encodes the model: engine is the *platform* (stable, contributor-friendly); generators are the *templates* (fork-friendly). Same logic as shadcn/ui under MIT — components are meant to be vendored, not configured.

## See also

- [Why clone-to-customize](why-clone-to-customize.md) — deep dive on the central bet
- [Why three phases](why-three-phases.md) — why Parse, Generate, Render are separate
- [How idempotency works](how-idempotency-works.md) — the mechanism behind order-independence
- [The GraphQL asymmetry](the-graphql-asymmetry.md) — building on the structuredClone substrate
- [Security model](security-model.md) — worker sandboxing
- [Comparison to other tools](comparison-to-other-tools.md) — how these principles differ from other codegen tools
- [Operational principles in `llms.md`](../llms.md#operational-principles-for-proposing-changes) — the LLM-facing condensation of these principles as anti-pattern overrides
