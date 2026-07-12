# Authoring generators

> Clone, customize, and write SKMTC generators.

## Who this is for

You want generator behavior beyond what enrichments expose, or you're writing a new generator from scratch. You'll be reading and writing TypeScript in `.skmtc/<project>/<gen-name>/src/`.

None of this is required to use SKMTC — if you haven't used it as a consumer yet, start with [`using/`](../using/). Authoring makes more sense once you've felt the customization limits, and it's more approachable than it sounds: generators build output with template literals (not ASTs) and compose with each other, so most authoring work is editing recognizable TypeScript. The [Authoring generators section of the docs front page](../README.md#authoring-generators) shows both ideas in real generator code.

## The customization gradient

```
Use stock          → install + accept defaults
Configure          → enrichments in client.json
Customize behavior → clone + edit source     ← extending starts here
Author new         → write a new generator
```

## Start here

- [Anatomy of a generator](anatomy-of-a-generator.md) — the one-page
  map of the parts (entry, base, enrichments, Projection, Snippets),
  how they run, and what keeps a generator maintainable. Read it
  before the tutorials.

## Tutorials

Linear walkthroughs to learn by doing.

- [01 — Cloning a generator](tutorials/01-cloning-a-generator.md)
- [02 — Authoring a model generator](tutorials/02-authoring-a-model-generator.md)
- [03 — Authoring an operation generator](tutorials/03-authoring-an-operation-generator.md)

## How-to guides

Recipes for specific problems.

- [Change export paths](how-to/change-export-paths.md)
- [Change identifier conventions](how-to/change-identifier-conventions.md)
- [Add a field type](how-to/add-a-field-type.md)
- [Swap a peer dependency](how-to/swap-a-peer-dependency.md)
- [Add enrichment options](how-to/add-enrichment-options.md)
- [Compose with another generator](how-to/compose-with-another-generator.md)
- [Handle GraphQL instead of OAS](how-to/handle-graphql-instead-of-oas.md)

## Recipes

Complete worked examples.

- [Design system across many APIs](recipes/design-system-across-many-apis.md)
- [Custom form field renderer](recipes/custom-form-field-renderer.md)

## Shared resources you'll need

- [Concepts](../concepts/) — the DSL, the pipeline, cross-generator coordination, refs
- [API reference](../reference/api/core-overview.md) — `@skmtc/core` exports, OAS object model, DSL classes
- [CLI reference](../reference/cli/overview.md) — `clone`, `create`, `dev`, `bundle`
- [Stock generators reference](../reference/stock-generators/) — source layout and clone seams per generator
- [Explanation](../explanation/) — design rationale for the architecture you'll be extending
