# Using SKMTC

> Install, configure, and run SKMTC to generate code from your schemas.

SKMTC generates TypeScript from an OpenAPI v3 or GraphQL schema — types,
validators, query hooks, forms, mocks, and server routes, all from one
schema in one run, all consistent with each other. Add a field to the
schema, regenerate, and every artifact updates together. The output is
ordinary source code you commit; nothing SKMTC-specific runs in your
app. Deciding whether SKMTC fits your project at all? Start with the
[project README](../README.md) — its "When to use SKMTC" section is the
honest fit test.

## Who this is for

You have an OpenAPI v3 or GraphQL schema and want code generated from it. Everything in this tree works with installed generators and JSON configuration — using SKMTC never requires writing or reading generator source code.

If you find yourself wanting to change a hardcoded value in a generator, that's the one thing configuration can't do: see [`authoring/`](../authoring/) (authoring generators) when you get there.

## The flow

```
init → install → configure (client.json) → generate
```

## Quick start

See [`tutorials/01-your-first-generation.md`](tutorials/01-your-first-generation.md) for the five-minute path.

## Tutorials

Linear walkthroughs to learn by doing.

- [01 — Your first generation](tutorials/01-your-first-generation.md)
- [02 — Multiple generators](tutorials/02-multiple-generators.md)
- [03 — Customize with enrichments](tutorials/03-customize-with-enrichments.md)

## How-to guides

Recipes for specific problems.

- [Install a generator](how-to/install-a-generator.md)
- [Configure enrichments](how-to/configure-enrichments.md)
- [Pin the schema source](how-to/pin-schema-source.md)
- [Skip or include operations](how-to/skip-or-include-operations.md)
- [Use SKMTC in CI/CD](how-to/use-in-ci-cd.md)
- [Update a schema and regenerate](how-to/update-a-schema.md)
- [Debug a failing generation](how-to/debug-failing-generation.md)

## Recipes

Complete worked examples.

- [Full-stack TypeScript app](recipes/full-stack-typescript-app.md)
- [API mocks for frontend development](recipes/api-mocks-for-frontend.md)
- [Multi-project monorepo](recipes/multi-project-monorepo.md)

## Shared resources

- [Concepts](../concepts/) — mental models that apply to both using and authoring
- [CLI reference](../reference/cli/) — every command, every flag
- [Settings reference](../reference/settings/) — `client.json` schema and enrichment shape
- [Stock generators reference](../reference/stock-generators/) — per-generator capabilities and enrichments
