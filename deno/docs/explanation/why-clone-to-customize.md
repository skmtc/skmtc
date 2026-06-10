# Why clone-to-customize

> The design choice behind treating generators as application code
> you own — and why this beats configuration-driven customization
> for SKMTC's intended use.

## The question

When a user needs the generator to produce something slightly
different — a different fetch wrapper, a different naming
convention, a custom field renderer — there are two paths a
codegen tool can offer:

1. **Configuration.** Expose flags/plugins/templates. Users edit
   config; the generator stays under the maintainer's control.
2. **Cloning.** Ship the generator as source code. Users copy it
   into their project and edit the source directly.

SKMTC chose cloning. This doc explains why, and when that's the
wrong choice.

## The short answer

Customization needs vary too much to be flattened into a
configuration schema. Every config flag either covers one user's
case and ignores ten others' — or grows the surface to cover all
ten, becoming unreadable and creating flag-interaction bugs. The
end state of "configuration-only" codegen is invariably a plugin
system, which is just cloning with a more expensive contract.

Cloning skips the dance: give people source code, let them edit it,
and trade auto-upgrades for full control. The model works for
shadcn/ui (UI components vendored as source), and it works here.

## The alternative: configuration

The configuration-first approach is well-trodden. Tools like
`openapi-generator`, `orval`, and (to a lesser extent) `kubb`
expose extensive configuration surfaces — flags, plugins,
templates, hooks — that let users shape output without touching
the generator's source.

### Pros of configuration

- **Auto-upgrade story.** When the upstream generator publishes a
  new version, users bump the dependency and get the fix or
  feature. No merge needed.
- **Declarative.** A `codegen.config.js` file fully describes the
  output. Reproducible, reviewable.
- **Small footprint in the consumer repo.** Generated artifacts
  live in the repo; the generator itself doesn't.
- **Documented surface.** Config schemas can be exhaustively
  documented; users learn the system by reading the schema.

### Cons of configuration

- **Schema bloat.** Each new requested customization either gets
  rejected (frustrating users) or accepted (growing the schema).
  Over time the config surface gets unwieldy. orval's config has
  dozens of options; openapi-generator's has hundreds.
- **Flag interactions.** Two flags that work fine individually
  produce broken output together. The combinatorial space is
  unaudited; bugs surface only when users hit them.
- **Eventually plugins are required anyway.** When config flags
  can't cover a case, the maintainer adds a plugin system. Plugins
  are mini-generators with an API contract. Now the maintenance
  surface is config + plugins + the plugin API itself.
- **Customization is bounded by maintainer imagination.** If the
  maintainer didn't think of your use case, you can't do it.
  Filing an issue and waiting is the only path.

The deeper problem: codegen consumers' customization needs are
**heterogeneous by nature**. A team using shadcn wants different
defaults than a team using DaisyUI; a team using Supabase wants
different hooks than a team using a custom REST API; a team using
SWR wants different mutation patterns than a team using TanStack
Query. No configuration schema can anticipate all of these without
either being trivially limiting or impossibly large.

## The choice: clone-to-customize

The cloning approach: every stock generator is published source
code. Users `skmtc clone` (or copy manually) the generator into
their project and edit the source. No central plugin API, no
configuration schema beyond what each generator's `enrichments`
explicitly exposes.

This is the same model as shadcn/ui — components are vendored as
source into the consumer's repo. The maintainer publishes
"reference implementations" that users own once they install them.

### Pros of cloning

- **Full control.** Want to change how nullable is encoded? Edit
  the source. Want to rename `useGetUsers` to `useUsers`? Edit
  the source. No flag, no plugin, no PR upstream.
- **Lives like app code.** The cloned generator is TypeScript
  in your repo. Code review, refactoring tools, grep, git blame —
  all work normally.
- **No upgrade-surface lock-in.** The engine API stays small and
  stable (Apache 2.0 with patent grant); cloned generators don't
  depend on the maintainer adding flags they need.
- **Discoverable by reading.** Want to know how a generator renders
  forms? Read its `src/`. The source is short — most stock
  generators are 200-500 lines. Documentation isn't the entry
  point; code is.
- **Forks become first-class.** A team forks `gen-shadcn-form` to
  produce `gen-acme-form`. Six months later they don't merge
  changes back — they don't have to. The fork is *their generator*.

### Cons of cloning

- **No auto-upgrades.** Upstream fixes don't reach cloned
  generators automatically. Users must manually merge or accept
  divergence.
- **Knowledge cost.** Cloning a generator requires reading and
  modifying TypeScript. A team without TS expertise can't easily
  customize.
- **Documentation gradient.** Generic stock-generator docs don't
  fully apply to clones. Each clone is potentially different from
  upstream.
- **Divergence over time.** Five teams cloning `gen-zod` end up
  with five different generators. Each one valid; collectively
  not interoperable.

## How SKMTC mitigates the cloning downsides

The model isn't "ship source code and hope for the best." Several
choices reduce the friction:

- **Stock generators are intentionally small.** Most are 200-500
  lines of TypeScript. The maintenance overhead of cloning one is
  low. Compare with cloning a 5,000-line generator with deep
  inheritance — that's untenable, and SKMTC's generators stay
  under that ceiling on purpose.
- **The engine API (`@skmtc/core`) is stable.** Apache 2.0
  licensed, semver-honored, intentionally small. Cloned
  generators depend on `@skmtc/core` directly, so its stability is
  load-bearing. Breaking changes are rare and announced.
- **The licensing split signals intent.** Engine: Apache 2.0
  (patent grant, contributor CLA appropriate). Stock generators:
  MIT (permissive, fork-friendly). The asymmetry tells users
  exactly which parts to treat as platform vs which to treat as
  templates.
- **Enrichments cover per-instance customization without
  requiring a clone.** When the customization is "this operation's
  form has a different submit label," enrichments handle it via
  `client.json`. Cloning is only required when *behavior* differs,
  not when *content* differs.
- **JSR makes the install-then-clone flow frictionless.** Install
  via `skmtc install` to read the source. Clone via
  `skmtc clone` when you decide to customize.

## The mechanical reason stock generators stay small

The pros/cons above describe the philosophy. The mechanical reason
SKMTC actively *resists* adding configuration flags to stock generators
is concrete: every config flag is a runtime branch every consumer
bundles.

A `toMyGenEntry({ emitDocument?: boolean })` flag on a stock generator
expands into something like:

```ts
if (config.emitDocument) {
  context.insertOperation({ projection: DocumentProjection, operation })
}
context.insertOperation({ projection: ResultProjection, operation })
```

Whichever value any one consumer passes, the bundled generator code
keeps both branches. Every consumer's `bundle.js` carries the runtime
check and the dead-code-eliminated other path. The flag is shared
infrastructure for a binary decision that — once the consumer has
made it — they will never change.

Cloning resolves the branch at source-edit time. The clone keeps the
branch it wants; the other branch is deleted. The cloned generator's
runtime is smaller, the unwanted Definition never registers, and the
customization is greppable in one file.

### The diagnostic question for a config flag

When a stock-generator author considers adding a flag, the test is:
*would two consumers of this package legitimately set this flag to
different values?*

- **If yes**, the configuration is **parametric** — the values vary
  per consumer's input, the shape of the configuration is the same
  across consumers, and only the values differ. Example:
  `toTypescriptEntry({ scalars: {...} })`. Each consumer's API has
  different scalar names; the names cannot be hardcoded. This is the
  legitimate role of generator-level config: parameters that no
  reasonable consumer could share.

- **If no**, the flag is a **binary feature toggle** — the author is
  trying to ship two slightly different generators in one package.
  Clone-to-customize handles this naturally. The first consumer
  clones and keeps the feature; the second consumer clones and
  removes it. Neither pays the cost of the other's branch.

Per-operation enrichments occupy a separate axis — they're per-instance
content (label, description, submit text), not per-consumer behavior.
Enrichments don't trigger this test; they're how SKMTC handles content
variation without requiring a clone.

## When this is the wrong choice

The cloning model assumes a certain kind of team and a certain
kind of project. It's wrong when:

- **You have hundreds of consumers needing centralized control.**
  An internal API team with 50 downstream consumers can't ship
  source-code generators; the consumers would all diverge. Use
  configuration-driven codegen with a strict maintained schema.
- **Your team can't read or write TypeScript.** Cloning assumes
  TS literacy. Mixed-skill teams may benefit from a more
  config-driven tool.
- **You need cross-team consistency more than per-team
  flexibility.** If "every team must produce hooks the same way" is a
  hard requirement, a configurable tool with no escape hatches is
  safer than a cloneable tool with infinite escape hatches.
- **Your generator changes weekly.** Frequent updates favor auto-
  upgrade. Cloned generators amortize the merge cost — fine if
  you clone once and maintain it; painful if upstream churns.
- **You're building a SaaS that generates code for thousands of
  customers.** Cloning would need to happen per-customer, which
  is operationally heavy. A configuration-based tool fits SaaS
  better.

SKMTC is designed for teams that:

- Are small enough that one or a few engineers can own the
  generator code
- Want full control over generated code's style and conventions
- Are willing to read and write TypeScript
- Prefer source-code transparency over configuration abstraction

If that's your team, the cloning model is freedom. If it isn't,
the configuration model is freedom. Different tools, different
constraints.

## A note on the configuration-vs-cloning spectrum

These aren't binary. Most real tools fall somewhere on a spectrum:

```
pure config            config + plugins         clone-to-customize
   ↑                          ↑                         ↑
openapi-generator         kubb, hey-api               SKMTC
orval                                                shadcn/ui
```

Tools further left optimize for low-friction default usage at the
cost of customization depth. Tools further right optimize for
customization depth at the cost of upgrade ergonomics. SKMTC is
explicitly at the right end of this spectrum — not because it's a
better point, but because it's the right point for its target
user.

## See also

- [Design philosophy](design-philosophy.md) — the broader principle
  set this fits into
- [Clone vs install concept](../concepts/clone-vs-install.md) —
  practical guidance on which command to use
- [Generators as packages concept](../concepts/generators-as-packages.md) —
  package shape and lifecycle
- [Comparison to other tools](comparison-to-other-tools.md) — how
  SKMTC's position compares against the codegen landscape
- [`skmtc-generator` skill](../skills/skmtc-generator/SKILL.md) —
  operational guide for cloning and authoring
