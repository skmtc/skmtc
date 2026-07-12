# @skmtc/core overview

> Index of exports from `@skmtc/core` for engine consumers. This is
> the navigation page — each section links to the detailed reference
> for the class or function.

`@skmtc/core` is the engine package — Apache 2.0, no JSR-published
generators included. It carries the three-phase pipeline, the
context classes, the DSL primitives, the OAS and GraphQL parsed
models, and the helpers that generators and Drivers depend on.

For the broader system context (the CLI, stock generators, the
worker runtime), see the [docs README](../../README.md) and
[the three phases concept](../../concepts/the-three-phases.md).

## Top-level exports

The package's `mod.ts` re-exports from internal modules. There is no
deep-import support (e.g., `@skmtc/core/dsl`) — consumers always
import from the top-level package:

```ts
import {
  toArtifacts,
  GenerateContext,
  Identifier,
  toOasOperationEntry,
  OasOperation
} from '@skmtc/core'
```

## Pipeline entry points

The functions you call to run the engine.

| Export | Purpose | Reference |
|--------|---------|-----------|
| `toArtifacts` | Run Parse → Generate → Render end-to-end | [toArtifacts](to-artifacts.md) |
| `toOasOperationEntry` | Factory for operation generators | [Projection bases](projection-bases.md) |
| `toModelEntry` | Factory for model generators | [Projection bases](projection-bases.md) |
| `toGqlOperationEntry` | Factory for GraphQL operation generators | [Projection bases](projection-bases.md) |

`toArtifacts` is the engine's true entry point. The `toXxxEntry`
factories are the generator-author entry points — what each
generator's `mod.ts` exports.

## Context classes

The per-phase orchestrators. Each is created internally by
`toArtifacts`; generator code interacts with the Generate context
heavily.

| Class | Phase | Reference |
|-------|-------|-----------|
| `ParseContext` | Parse | [ParseContext](parse-context.md) |
| `GenerateContext` | Generate | [GenerateContext](generate-context.md) |
| `RenderContext` | Render | [RenderContext](render-context.md) |

`GenerateContext` is the one generator code touches most — via
`this.context.register(...)`, `insertOperation(...)`, `insertModel(...)`, etc.

## DSL classes

The building blocks generators use to produce code.

| Class | Role | Reference |
|-------|------|-----------|
| `SnippetBase` | Root class for Snippets (anonymous helpers) and Projections | [SnippetBase](dsl-snippet-base.md) |
| `DefinitionBase` | Wraps a producer's value with its identifier and generator key; rendering lives in the lang subclass (`TsDefinition`) | [Definition](dsl-definition.md) |
| `IdentifierBase` | Neutral identifier data (name, typeName, exported); the per-language declaration type lives on the lang subclass (`TsIdentifier`) | [Identifier](dsl-identifier.md) |
| `ImportBase` | Neutral import data; the rendered `import { X } from '...'` statement is the lang subclass (`TsImport`) | [Import](dsl-import.md) |
| `ContentSettings` | Per-Projection bundle (identifier, exportPath, enrichments) | [ContentSettings](content-settings.md) |
| `FileBase` | Neutral output-file base (`CodeFileBase` for code files; the concrete `TsFile` lives in the lang package) | [File](dsl-file.md) |
| `JsonFile` | Variant of File for JSON output | [JsonFile](dsl-file.md) |
| `CustomValue` | Wraps raw strings as DSL values | [CustomValue](dsl-custom-value.md) |
| `Inserted` | Marker class returned by `insertNormalizedModel` etc. | [Inserted](dsl-inserted.md) |

The DSL classes form a small set of well-defined primitives. The
operational principle: **use them, don't bypass them** — raw strings
in identifier positions break the import-rendering story under
`verbatimModuleSyntax`. See [Identifier](dsl-identifier.md)
for the factory surface.

## Projection bases (factories)

The three factory functions that produce Projection base classes.
Generators extend the result.

| Factory | Produces base for | Reference |
|---------|-------------------|-----------|
| `toOasOperationProjectionBase` | OAS operation generators (REST endpoints) | [Projection bases](projection-bases.md) |
| `toModelProjectionBase` | Model generators (OAS schemas) | [Projection bases](projection-bases.md) |
| `toGqlOperationProjectionBase` | GraphQL operation generators | [Projection bases](projection-bases.md) |

The base classes provide `insertOperation`, `insertModel`, and
`insertNormalizedModel` — thin wrappers around the same-named methods
on [GenerateContext](generate-context.md) that auto-fill
`destinationPath` from `settings.exportPath`. They also enforce the
constructor's `args: { context, operation/schema, settings }`
contract.

## OAS object model

The parsed OpenAPI document. See [OAS document model](oas-document-model.md)
for the full set.

| Class | Reference |
|-------|-----------|
| `OasDocument` | [OAS document model](oas-document-model.md) |
| `OasOperation` | [OAS document model](oas-document-model.md) |
| `OasResponse`, `OasRequestBody`, `OasParameter`, `OasHeader` | [OAS document model](oas-document-model.md) |
| `OasMediaType`, `OasExample`, `OasComponents` | [OAS document model](oas-document-model.md) |
| `OasSchema` (the union) and its 8 variants | [OAS schema variants](oas-schema-variants.md) |
| `OasRef<T>` | [OasRef](oas-ref.md) |
| `OasVoid` | [OasRef](oas-ref.md) (used in same contexts) |

The union-with-discriminator pattern (`OasSchema` is a union of 8
sibling classes, **not** a class hierarchy) is load-bearing. See the
[OAS schema variants reference](oas-schema-variants.md) for the "why
not a BaseSchema" discussion.

## GraphQL object model

| Class | Purpose | Reference |
|-------|---------|-----------|
| `GqlDocument` | Parsed GraphQL schema | [GqlDocument](gql-document.md) |
| `GqlRegistry` | Looks up GraphQL types by name | [GqlDocument](gql-document.md) |
| `GqlOperation` | A single GraphQL operation | [GqlDocument](gql-document.md) |

GraphQL parsing happens **worker-side** (unlike OAS, which is
host-side). See [the worker runtime concept](../../concepts/the-worker-runtime.md)
for the reason.

## Type system helpers

The TypeScript-level utility types and interfaces.

| Type | Purpose |
|------|---------|
| `IdentifierType` | `{ type: string; typeName?; exported? }` — the non-name identifier parts `toIdentifierType` returns; the per-language declaration vocabulary (`TsEntityType`, `'variable' \| 'type' \| 'class' \| 'interface' \| 'namespace'`) and its keyword mapping live in `@skmtc/lang-typescript` |
| `GeneratedValue` | Base structural type for what `DefinitionBase` wraps |
| `Method` | HTTP method literal type |
| `OasParameterLocation` | `'path' \| 'query' \| 'header' \| 'cookie'` |
| `OasComponentType` | Union of all top-level OAS component classes |
| `Stringable` | Anything with a `toString(): string` — every DSL primitive implements it |

### Naming and identifier helpers

| Helper | Purpose |
|--------|---------|
| `toEndpointName(operation)` | Operation → camelCase name (fallback when `operationId` is absent) |
| `camelCase(s)` | String → camelCase |
| `capitalize(s)` | First-letter uppercase |
| `decapitalize(s)` | First-letter lowercase |
| `toMethodVerb(method)` | HTTP method → verb name (e.g., `'post'` → `'Create'`) |
| `isIdentifierName(s)` | Check if a string is a valid JS identifier |

### Parsing helpers

| Helper | Purpose |
|--------|---------|
| `tryParseAt(ctx, key, valibotSchema, value)` | Lenient parse with fail-open behavior — see [error handling philosophy](../../concepts/error-handling-philosophy.md) |
| `removeErroredItems()` (method on `ParseContext`) | One-hop pruning of items whose dependencies failed to parse |

## Stack trail and tracing

| Class | Purpose | Reference |
|-------|---------|-----------|
| `StackTrail` | Threads "where am I in the doc graph" through all phases | [StackTrail](stack-trail.md) |

`StackTrail` is the single piece of cross-phase context that survives
phase teardown. The CLI creates one at the top of `toArtifacts` and
passes it down; each phase appends segments as it descends. When an
error surfaces, the trail provides "where in the spec did this
happen" context for the diagnostic.

## License

The engine (`@skmtc/core`) is **Apache 2.0**, providing:

- A patent grant from contributors
- Clear contributor terms via the Apache CLA structure
- Compatibility with most open-source licenses

This contrasts with the stock generators in `@skmtc/gen-*`, which are
**MIT** — chosen for fork-friendliness (the clone-to-customize
philosophy).

See the [license rationale in the README](../../README.md#license)
for the full reasoning.

## Versioning

`@skmtc/core` follows semantic versioning. Breaking changes to:

- Context class APIs (e.g., `register` signature)
- DSL class APIs (e.g., the lang package's `createVariable`)
- OAS or GraphQL parsed model shapes

are major-version bumps. Additive changes (new helper methods, new
exported types) are minor bumps.

Stock generators tend to lag the engine by a minor version while
they adapt to API additions.

## See also

- [The three phases concept](../../concepts/the-three-phases.md) — pipeline overview
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) — DSL mental model
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) — how DSL primitives compose
- [The worker runtime concept](../../concepts/the-worker-runtime.md) — how the engine is hosted
- [Reference: glossary](../glossary.md) — terminology
- [Anatomy of a generator](../../authoring/anatomy-of-a-generator.md) — the authoring orientation
