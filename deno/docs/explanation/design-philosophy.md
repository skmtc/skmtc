# Design philosophy

> The principles that generate SKMTC's design choices — what we value, what we refuse, what we trade.

## The core bet

SKMTC bets that generated code should be ordinary source code — committed,
readable, reviewable — and that customization should be ordinary source
code too. Generation is idempotent by construction, so any set of
generators converges on the same output in any order; parsing is lenient
and diagnostics are strict, so one bad schema narrows the output instead
of killing the run; and when stock output isn't what you want, you clone
the generator and edit recognizable TypeScript instead of negotiating
with a configuration surface. Everything else in this page is a
consequence of those four commitments: output as source, idempotency by
construction, lenient input with strict diagnostics, and
clone-to-customize.

## The principles

Each principle is **contestable** — a choice SKMTC makes that another reasonable codegen tool makes differently. If a claim could equally describe orval, kubb, OpenAPI Generator, and graphql-codegen, it isn't load-bearing for SKMTC and isn't here.

### 1. Clone-to-customize, not configure-to-customize

> Customization lives in source code you own, not in configuration flags you set.

#### What it means in practice

A stock generator's hardcoded export path or naming convention is not a
missing feature — it is the seam you edit after `skmtc clone`. The cloned
source lives in your project, the CLI bundles it like any installed
generator, and your customization is a diff you own rather than a flag
the maintainer supports forever. Enrichments remain for per-instance
values (a label, a placeholder); changes to *behavior* are edits.

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

Generators never declare dependencies on each other and never run in a
declared order. When one generator needs a peer's output it inserts it:
the engine constructs the peer's Projection on the first request and
returns the registered definition on every request after, so whichever
generator asks first, the file map converges to the same content.
Reordering generators in `client.json` is a no-op by construction, not
by testing discipline.

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

Every schema item parses inside its own guard: a failed item becomes a
`ParseIssue` rather than an exception, and everything that depended on
the failed item is pruned so downstream generators see a smaller — but
internally valid — document. The manifest then accounts for every issue
exhaustively, so partial output always arrives with a complete record of
what is missing and why.

#### Consequences

- `tryParseAt` wraps every per-item parser; throws become `ParseIssue`s
- `removeErroredItems` cascade-prunes dependents of failed refs
- Type-inference fallbacks for schemas missing `type` (with warnings)
- Manifest records every issue; exit code derives from issue levels, not from process throws

#### Deeper discussion

See [Error handling philosophy](error-handling-philosophy.md).

### 4. Output as source code, not a runtime library

> SKMTC ships nothing at runtime. Generated TypeScript is committed to the consumer's repo and lives like any other source code.

#### What it means in practice

A generated file has no runtime dependency on SKMTC — no import, no
wrapper, no client object. It imports the same libraries the equivalent
handwritten file would (zod, Tanstack Query, React) and nothing else.
You commit it, review schema changes as ordinary diffs in pull requests,
and refactor or grep it with the tools you already use. SKMTC's
involvement ends when the files are written.

#### Consequences

- Drift between schema and output is detectable via `git diff`
- Generated code can be code-reviewed, refactored, grep-searched
- Upgrade workflow is "regenerate," not "bump a library version"
- The bundle/worker stays inside the build pipeline; nothing crosses into the consumer's bundle

#### Deeper discussion

See [Use SKMTC in CI/CD](../using/how-to/use-in-ci-cd.md) — the drift
check that this principle makes possible.

### 5. TypeScript-native templates, not template files

> Templates are template literals inside TS classes, composed with `${...}` interpolation. No Mustache, Handlebars, or EJS.

#### What it means in practice

A generator's output template is a template literal inside a class:
`toString()` returns real TypeScript with `${...}` holes, and every
interpolated value is a typed field the compiler checks. There is no
template file to load, no helper registry, and no second language to
learn — editing a generator is editing TypeScript, with rename-symbol
and go-to-definition working across the template boundary.

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

SKMTC ships no bundler, no sandbox, and no package format of its own.
`deno bundle` produces the generator bundle, a Worker with network and
subprocess permissions disabled is the sandbox, and JSR is how
generators are published and versioned. The engine's job is codegen;
the platform's job is everything else — which keeps the engine small
enough to read.

#### Consequences

- The engine is small because most platform-level concerns are delegated
- Generators run sandboxed by virtue of Deno Worker permissions, not bespoke isolation
- JSR (Deno's registry) is the distribution channel for generators
- The project is Deno-locked (acceptable; the platform delegation pays for it)

#### Deeper discussion

See [The worker runtime](../concepts/the-worker-runtime.md) and [The GraphQL asymmetry](the-graphql-asymmetry.md).

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
