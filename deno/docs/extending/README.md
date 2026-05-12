# Extending SKMTC

> Clone, customize, and author SKMTC generators.

## Who this is for

You want generator behavior beyond what enrichments expose, or you're authoring a new generator from scratch. You'll be reading and writing TypeScript in `.skmtc/<project>/<gen-name>/src/`.

If you haven't used SKMTC as a consumer yet, start with [`using/`](../using/) — extending makes more sense once you've felt the customization limits.

## The customization gradient

```
Use stock          → install + accept defaults
Configure          → enrichments in client.json
Customize behavior → clone + edit source     ← extending starts here
Author new         → write a new generator
```

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
- [API reference](../reference/api/) — `@skmtc/core` exports, OAS object model, DSL classes
- [CLI reference](../reference/cli/) — `clone`, `create`, `dev`, `bundle`
- [Stock generators reference](../reference/stock-generators/) — source layout and clone seams per generator
- [Explanation](../explanation/) — design rationale for the architecture you'll be extending
