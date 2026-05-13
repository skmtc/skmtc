# Comparison to other tools

> SKMTC vs the TypeScript codegen landscape — openapi-typescript,
> hey-api, orval, kubb, openapi-generator, graphql-codegen — and
> where SKMTC sits along the customization-vs-convenience spectrum.

## The question

Several mature TypeScript code generators exist. They're widely
used, have larger communities, and (in some cases) more polished
ergonomics. Where does SKMTC sit in this landscape, and what
case is it actually making?

## The TypeScript codegen landscape

The space divides roughly along four axes: scope, customization
model, language target, and runtime cost. Most tools cluster into
a few archetypes.

### Types-only

Tools that produce TypeScript types and nothing else. Smallest scope,
highest precision.

- **`openapi-typescript`** — by Drew Powers. Generates a single
  `paths` object with response/request types per endpoint. Zero
  runtime cost; no client code. Lean and stable.

### Types + a client

Tools that produce types plus a fetch wrapper or similar runtime
client. Larger scope; more decisions baked into the output.

- **`@hey-api/openapi-ts`** — the modern descendant of
  `openapi-typescript-codegen`. Generates types and a configurable
  client. Plugin architecture for extending output (Zod, MSW,
  custom transforms).
- **`orval`** — by Anthony Cangelosi. Generates types, hooks
  (React Query / SWR), and a Zod-validation layer. Heavily
  configuration-driven; sophisticated naming conventions out of
  the box.

### Plugin-based multi-target

Tools that ship a small core and rely on plugins for actual
output. Architecturally similar to SKMTC's stock generators, but
plugins are typed contracts rather than cloneable source.

- **`kubb`** — by Stijn Van Hulle. Plugin system with shipped
  plugins for types, Zod, hooks, MSW, etc. Closest SKMTC peer in
  design intent; differs in customization model (plugins vs
  clones) and coordination (explicit composition vs name-based
  memoization).

### Multi-language behemoths

Tools that aren't TypeScript-specific and target many languages.
Different universe entirely — Java-based, designed for "any
language from any spec."

- **`openapi-generator`** (and its predecessor, swagger-codegen)
  — by the OpenAPI initiative. Java-based, Mustache templates,
  dozens of language targets. Powerful and unwieldy; the
  TypeScript output is one target among many and tends to feel
  generic.

### GraphQL-native

Tools focused on GraphQL.

- **`graphql-codegen`** — by The Guild. Plugin-based, ecosystem
  of plugins for every imaginable GraphQL consumer (Apollo,
  TanStack Query, Relay, etc.). The de facto GraphQL codegen.

## SKMTC's distinctive position

SKMTC is closer to `kubb` than anything else in spirit:
multi-target, plugin-shaped, TypeScript-native. The distinction
is the **customization model**: SKMTC uses clones (source code in
the consumer repo) rather than plugins (configuration of
installed packages).

The other differentiator: SKMTC has **cross-generator
coordination by name**. Two generators producing the same
identifier in the same file converge automatically — they don't
need to know about each other. Most tools require explicit
composition (a plugin reading another plugin's output, or a
shared type registry).

Both differentiators stem from the same design goal: the
generator code is **the customization surface**. Clones are
where users edit; name-based coordination is what lets cloned
generators stay independent without manual wiring.

## Comparison axes

### Customization model

```
openapi-generator   →  templates  (Mustache files you can override)
orval               →  config heavy  (dozens of options, hooks)
hey-api             →  config + plugins  (typed plugin contracts)
kubb                →  plugins  (plugin API drives output)
SKMTC               →  clones  (source code in your repo)
shadcn/ui           →  clones  (the original of this model)
```

Right-to-left: less per-instance flexibility, more upgrade
ergonomics. Pick based on whether you'd rather edit source or
navigate a config schema.

### Generator authoring surface

For users wanting to write a *new* generator (not just configure
an existing one):

- `openapi-generator`: write Mustache templates + Java glue
- `orval`: write a custom transformer plugin (TypeScript)
- `hey-api` / `kubb`: implement the plugin interface (TypeScript)
- SKMTC: copy a stock generator as a starting point, edit
  TypeScript

The bar for "extending" SKMTC is the same as the bar for using
it — TypeScript. No separate template DSL, no plugin contract
beyond `toOasOperationEntry` / `toModelEntry`.

### Idempotency

How the tools handle "two generators want to produce the same thing":

- Most tools don't address this — generators are independent and
  write into different files
- `kubb` has explicit plugin ordering and composition
- SKMTC handles it via memoization: same `(identifier.name,
  exportPath)` → same definition. Generator order doesn't matter.

Idempotency-by-construction is rare among codegen tools because
it requires investment in coordination infrastructure. SKMTC's
[memoization mechanism](how-idempotency-works.md) is the load-
bearing piece.

### Formatting

- `openapi-typescript`: no formatting (caller's job)
- `orval`: runs Prettier on output by default
- `hey-api`, `kubb`: run Prettier
- `openapi-generator`: usually formats per target language
- SKMTC: **doesn't run Prettier**. No formatter in the pipeline;
  consumer runs their own formatter as a post-generation step.

This is a small but consequential divergence. SKMTC users need a
post-generate format step.

### Multi-protocol support

- `openapi-typescript`, `orval`, `kubb`, `hey-api`: OAS only
- `graphql-codegen`: GraphQL only
- `openapi-generator`: OAS only
- SKMTC: OAS and GraphQL via a unified engine

The unified support is unusual. Most tools live on one side of
the OAS/GraphQL divide. SKMTC's GraphQL story isn't as deep as
graphql-codegen's, but the engine is genuinely shared — the
GraphQL generators reuse the TypeScript schema renderer, for
example.

### Runtime cost

- `openapi-typescript`: zero (types only)
- SKMTC: zero (generated source code, no runtime library)
- `orval`, `hey-api`, `kubb`: small (the generated client has some
  runtime helpers)
- `openapi-generator`: medium-large depending on target

SKMTC and `openapi-typescript` both ship nothing to the
consumer's runtime. The generated code is committed source, no
peer-dependency package needed at deploy time.

## Per-tool comparison

### vs `openapi-typescript`

`openapi-typescript` is the canonical "I just want types" tool.
SKMTC produces MORE than types (Zod schemas, hooks, forms, MSW
handlers), so the comparison is unfair in one direction.

The other direction: `openapi-typescript`'s type output is more
sophisticated than SKMTC's `gen-typescript` in some details
(better discriminated-union handling for some OAS shapes; more
careful handling of `additionalProperties`).

**Pick `openapi-typescript`** when types are all you need and
you want the most-mature TS-type generator in the ecosystem.
**Pick SKMTC** when you need types *plus* the rest (validation,
hooks, UI scaffolds).

### vs `@hey-api/openapi-ts`

`hey-api` is the most polished mid-scope tool — types, client,
plugin-extensible output. The plugin architecture is well-typed
and the maintainers are responsive.

vs SKMTC: comparable output coverage (types, Zod, MSW, hooks).
Different customization model: hey-api uses plugin config; SKMTC
uses clones.

**Pick hey-api** when you want a polished out-of-the-box experience
and don't want to maintain cloned generators. **Pick SKMTC** when
you want full control over the generator code and are willing to
own that maintenance.

### vs `orval`

`orval` has the strongest config-driven ergonomics in the space.
Sophisticated naming, framework-aware output (React Query, SWR,
Vue Query), MSW integration, mock generation.

vs SKMTC: orval is more polished if your needs fit its
opinions. SKMTC is more flexible if they don't.

**Pick orval** when you're building a React app with TanStack
Query and want minimum setup. **Pick SKMTC** when orval's
opinions don't match your team's, or you want generators living
as project source code.

### vs `kubb`

The closest peer to SKMTC in design intent. Plugin-based,
multi-target, TypeScript-native, clean architecture.

The differences are subtle but real:

- **Customization:** kubb's plugins are the customization unit;
  SKMTC's clones are.
- **Coordination:** kubb composes plugins explicitly (one plugin
  reads another's output); SKMTC composes by name (memoization).
- **Authorship:** kubb plugins implement the kubb plugin
  interface; SKMTC generators are TypeScript classes extending a
  projection base.
- **Maturity:** kubb has a larger ecosystem and more users; SKMTC
  is younger and more opinionated.

**Pick kubb** when you want plugin-shaped extensibility with a
larger community. **Pick SKMTC** when you want clone-shaped
extensibility and don't need the ecosystem.

### vs `openapi-generator`

Different universe. openapi-generator is Java-based, multi-
language, template-driven. Its TypeScript output tends to feel
mechanical and generic — adequate for "ship something" but not
calibrated to TS idioms the way TS-native tools are.

**Pick openapi-generator** when you need code in five languages
from the same spec. **Pick SKMTC** if you're TypeScript-only and
want better-feeling output.

### vs `graphql-codegen`

The de facto GraphQL codegen tool. Massive plugin ecosystem,
deeply integrated with major GraphQL clients (Apollo, Relay,
URQL).

vs SKMTC: graphql-codegen is GraphQL-native and far deeper in
that domain. SKMTC's GraphQL support is more recent and shallower.

**Pick graphql-codegen** when GraphQL is your primary use case.
**Pick SKMTC** when you have both OAS and GraphQL and want one
toolchain.

## When to pick what

The decision shorthand:

- **"I just want types"** → `openapi-typescript`
- **"I want types + hooks + minimum setup"** → `orval` or `hey-api`
- **"I want plugins + community"** → `kubb` (or `hey-api`)
- **"I want to own my generators as source code"** → SKMTC
- **"I need multi-language output"** → `openapi-generator`
- **"I'm GraphQL-only"** → `graphql-codegen`
- **"I have both OAS and GraphQL"** → SKMTC (or run two of the above)

SKMTC isn't "better" than these tools — it's positioned
differently. The clone-to-customize bet is the central
distinction. If that bet fits your team, SKMTC is the right tool.
If it doesn't, one of the others probably is.

## See also

- [Design philosophy](design-philosophy.md) — the principles
  underlying SKMTC's position
- [Why clone-to-customize](why-clone-to-customize.md) — the
  central differentiator vs other tools
- [How idempotency works](how-idempotency-works.md) — the
  coordination mechanism most tools lack
- [Status and roadmap](status-and-roadmap.md) — current maturity
  of SKMTC components
