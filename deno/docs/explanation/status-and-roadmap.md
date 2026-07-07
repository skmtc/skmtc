# Status and roadmap

> What's stable, what's active, what's experimental — and what's
> known to be broken or incomplete.

## The question

When picking up SKMTC, two things matter: which components can
you depend on, and which are still settling? This doc maps the
component landscape and names the known limitations explicitly
so users aren't surprised.

## The short answer

The engine (`@skmtc/core`) and CLI are **stable**. Stock
generators range from **stable** (gen-typescript, gen-zod,
gen-msw, gen-shadcn-form) through **active** (the
tanstack-query-* family, gen-shadcn-select/table) to
**experimental** (GraphQL generators, gen-arktype, gen-supabase-
hono, gen-express).

The project is **locally developed** — there's no
external-contribution flow yet. Breaking changes are managed by
the project owner; semver applies but pre-1.0 expectations apply.

## Component status

### Engine (`@skmtc/core`)

**Stable.** The engine API (context classes, DSL primitives,
projection-base factories) is well-shaped and unlikely to change
in non-additive ways. Cloned generators depend on this API
directly, so its stability is load-bearing.

**Versioning:** semver. Major-version bumps are reserved for API
breaks. Minor and patch follow the usual conventions.

**What's still evolving:** internal implementation details (parse
phase optimizations, render output ordering) may change between
patch versions without API impact.

### CLI (`@skmtc/cli`)

**Stable.** Command surface (`init`, `clone`, `install`,
`generate`, `bundle`, `doctor`, `agent-context`, etc.) is well-
shaped.

**What's still evolving:** the JSON output schemas may extend
(adding fields is safe; removing or renaming is a breaking
change and follows semver).

### Stock generators

Stock generators are at varying maturity levels. The categories
below reflect observed activity and stability, not formal
maintenance commitments.

#### Stable

Battle-tested across multiple consumer projects. API and output
shape unlikely to change significantly.

- **`@skmtc/gen-typescript`** — TS type aliases. Mature scalar
  mapping, well-shaped output.
- **`@skmtc/gen-zod`** — Zod schemas. Mature per-variant
  dispatch, well-shaped modifier composition.
- **`@skmtc/gen-msw`** — MSW handlers + shared route list.
  Demonstrates the shared-aggregate pattern at production
  quality.
- **`@skmtc/gen-shadcn-form`** — React forms. The most
  architecturally complex stock generator; cross-generator
  composition is well-exercised here.

#### Active

In use, but the output shape and enrichment surface are still
evolving. Cloning is reasonable; expect to merge upstream
changes occasionally.

- **`@skmtc/gen-tanstack-query-fetch-zod`** — fetch-based hooks.
  Stable shape; transport details (error handling, retries) may
  evolve.
- **`@skmtc/gen-tanstack-query-supabase-zod`** — Supabase
  transport variant.
- **`@skmtc/gen-shadcn-select`** — searchable select component.
- **`@skmtc/gen-shadcn-table`** — data table component.

#### Experimental

Recent additions or less-exercised generators. Clone for
specific projects but expect more frequent shape changes.

- **`@skmtc/gen-arktype`** — ArkType validation. Smaller user
  base than gen-zod; some edge cases may be undercovered.
- **`@skmtc/gen-valibot`** — Valibot validation. Similar maturity
  to gen-arktype.
- **`@skmtc/gen-express`** — Express route stubs. Demonstrates
  the shared-singleton pattern; specific output style still
  evolving.
- **`@skmtc/gen-supabase-hono`** — Hono routes for Supabase Edge.
  Similar to gen-express in maturity.

The GraphQL surface is narrower than the OAS surface. The core
GraphQL parse path works, but corner cases (interface types, union
resolution, deeply nested fragments) may surface issues. GraphQL
generators are currently custom builds per project — the 2026-05-13
cleanup removed `@skmtc/gen-graphql-operation` and
`@skmtc/gen-graphql-typed-document-node` (both deleted as thin
wrappers around `TsProjection` with zero real consumers).

## Known limitations

These are observed gaps and edges that users should be aware of.

### `#SKM-47` — `insertNormalizedModel` fallback-name integrity

When `insertNormalizedModel` is called with an **inline schema**
(no ref), the cache key uses the caller's `fallbackName`. Two
generators passing different fallback names for the same inline
schema produce two separate definitions.

The integrity gap: the system can't tell that two inline schemas
are "the same" without a canonical name. Refs converge cleanly;
inline schemas don't.

**Mitigation:** generator authors should prefer refs when
possible. Spec authors should hoist commonly-shared inline
schemas to `components.schemas`. This is a pure-spec hygiene
issue; the engine can't fully repair it.

See [how idempotency works](how-idempotency-works.md#inline-schema-fallback-names)
for the deeper discussion.

### One-hop cascade pruning

When a schema fails to parse, its **direct dependents** are
pruned from the model (via `removeErroredItems`). Second-order
dependents — items that depend on a pruned dependent — aren't
automatically pruned.

In practice this means a single bad schema may leave some
operations in a half-valid state: the schema is pruned, an
operation referencing it has its parameter pruned, but a second
operation that referenced the first via some transitive path may
still try to render and surface a confusing error.

**Mitigation:** the diagnostic stream surfaces all pruning
events. Users should treat the *first* failure in a chain as the
root cause, even if it produces noise downstream.

### Render does not format output

No formatter (Prettier, Biome, `deno fmt`, or otherwise) runs
inside `@skmtc/core`. The Render phase is pure serialization —
it stringifies the file map and returns the result unmodified.

Consumers run their own formatter as a post-generate step. The
engine deliberately doesn't bundle a formatter: it'd add weight
to the worker payload and isn't always wanted (some teams prefer
no formatting, or use a non-Prettier tool).

A future engine version may add optional in-pipeline formatting
(see [roadmap](#on-the-roadmap)), but the default is and will
likely remain "consumer's concern."

### Same-name collisions in inline schemas

If two generators independently produce a definition with the
same `(name, exportPath)` key, behavior depends on the insertion path:

- **Driver path** (the usual flow via `insertModel`, `insertOperation`,
  or `insertNormalizedModel`): the second writer throws
  `Registered definition mismatch: '<name>' in file '<exportPath>'.
  Cached key '<key>' does not match new key '<key>'`. The collision
  is loud, not silent — see `affirmDefinition` in the three Drivers.
- **Bare `register({ definitions })` path** (less common — direct
  use of the low-level API): silent **first-write-wins** via
  `Map.has`. The second is dropped with no diagnostic.

In practice the Driver path catches most collisions. The bare-register
sharp edge is what to watch for if you call `context.register` directly.

**Mitigation:** prefer the Driver methods so collisions throw.
During development, watch for the "Registered definition mismatch"
error (Driver path) or missing artifacts "that should be there"
(bare-register path).

### No incremental builds

Every `skmtc generate` is from cold. The engine doesn't compare
against previous output or skip unchanged operations.

For typical schemas (dozens to low hundreds of operations) this
is fine — generation takes seconds. For very large schemas
(thousands of operations) it'd be a problem.

**Mitigation:** none in the engine. If you have very large
schemas, consider partitioning into multiple SKMTC projects.

### Worker payload size

The Worker bundle includes all peer dependencies the generators
reference. For projects with many generators (especially GraphQL
+ heavy validation), the bundle can grow into multiple megabytes,
slowing Worker spawn.

**Mitigation:** measure the bundle on disk —
`wc -c "$(skmtc bundle <project> --json | jq -r .bundlePath)"`.
`bundle --json` itself returns only `{ kind, projectName, bundlePath }`;
the size has to come from `stat`/`wc -c` against the path. If the bundle is
unreasonably large, remove unused generators.

### Stale-bundle warnings

After editing a cloned generator's source, the `bundle.js` is
stale until `skmtc bundle` runs. `skmtc generate` would use the
old bundle, producing pre-edit output.

**Mitigation:** `skmtc doctor` flags stale bundles. Users should
re-bundle after generator-source edits.

## On the roadmap

These are speculative; treat them as direction-of-travel, not
commitments.

- **Native OAS 3.1 support** (not just normalized-to-3.0).
  Currently 3.1 features that don't map to 3.0 are lossily
  converted; native handling would preserve them.
- **Improved cascade pruning** — multi-hop dependent removal so
  partial-state surprises don't surface.
- **Optional internal formatter** — bundling a lightweight
  formatter for users who don't want a separate Prettier step.
- **Bundle size improvements** — tree-shaking generator code more
  aggressively.
- **Better diagnostics for same-name collisions** — log a
  warning when two generators converge on the same
  `(name, exportPath)` key.

The roadmap reflects user-facing improvements. Internal
refactorings (engine API tidying, performance) happen
opportunistically and don't appear here.

## Breaking-change policy

- **Engine and CLI:** follow semver strictly. Breaking changes
  bump the major version. Deprecation warnings precede major
  bumps where possible.
- **Stock generators:** may break independently of the engine.
  Pin via JSR lockfile if you depend on a specific output shape.
  Cloned generators are insulated from upstream breaking changes
  by virtue of being copied.
- **`client.json` schema:** additive changes are safe.
  Field-removal or semantic changes follow the engine's semver.
  Migration notes accompany breaking changes when they happen.

The clone-to-customize model means stock-generator breaking
changes have a smaller blast radius than they'd have in a
configuration-driven tool. Users who've cloned are insulated;
users on stock get the upgrade when they explicitly bump.

## See also

- [Design philosophy](design-philosophy.md) — the principles that
  shape what's prioritized
- [How idempotency works](how-idempotency-works.md) — context for
  `#SKM-47` and the same-name collision limitation
- [Comparison to other tools](comparison-to-other-tools.md) —
  how SKMTC's maturity compares to other codegen tools
- [API: toArtifacts](../reference/api/to-artifacts.md) — the
  engine entry point whose API is part of the stable contract
