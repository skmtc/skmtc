# Stock generators overview

> Catalog of the generators shipped under `@skmtc/gen-*`. They're
> MIT-licensed and intended as **starting points to read, learn from,
> and clone** — not as polished products to install unchanged.

The stock generators demonstrate the major SKMTC patterns at
production-realistic complexity. Most users will pick one or two as
templates, clone them via `skmtc clone`, and edit the source to fit
their own conventions (output paths, naming, peer libraries,
emitted style).

## What stock generators are

A stock generator is a published `@skmtc/gen-*` package on JSR. Each
ships:

- An `Entry` (`toOasOperationEntry` / `toModelEntry` /
  `toGqlOperationEntry`) exported from `src/mod.ts`
- One or more `Projection` classes (`src/<Name>.ts`)
- An optional enrichment schema (`src/enrichments.ts`)
- A `deno.json` declaring its peer dependencies

Their license (MIT) is deliberately fork-friendly. The engine
(`@skmtc/core`) is Apache 2.0; the templates are MIT.

## Catalog

### Schemas and types (model generators)

Run per OAS schema component. The four below have **near-identical
entry shape** — they differ only in the Projection class. Together
they're the strongest demonstration of the clone-to-customize
philosophy.

| Generator | Output | Reference |
|-----------|--------|-----------|
| `@skmtc/gen-typescript` | TypeScript type aliases | [gen-typescript](gen-typescript.md) |
| `@skmtc/gen-zod` | Zod validation schemas | [gen-zod](gen-zod.md) |
| `@skmtc/gen-valibot` | Valibot validation schemas | [gen-valibot](gen-valibot.md) |
| `@skmtc/gen-arktype` | ArkType validation schemas | [gen-arktype](gen-arktype.md) |

### Client-side (data fetching, mocks)

Run per OAS operation.

| Generator | Output | Reference |
|-----------|--------|-----------|
| `@skmtc/gen-tanstack-query-fetch-zod` | Tanstack Query hooks (fetch transport) | [gen-tanstack-query-fetch-zod](gen-tanstack-query-fetch-zod.md) |
| `@skmtc/gen-tanstack-query-supabase-zod` | Tanstack Query hooks (Supabase Postgrest transport) | [gen-tanstack-query-supabase-zod](gen-tanstack-query-supabase-zod.md) |
| `@skmtc/gen-msw` | MSW mock handlers + a shared route list | [gen-msw](gen-msw.md) |

### UI (React, requires composition)

Run per OAS operation. Compose with one of the model generators
above for type-safe inputs.

| Generator | Output | Reference |
|-----------|--------|-----------|
| `@skmtc/gen-shadcn-form` | React form using shadcn/ui | [gen-shadcn-form](gen-shadcn-form.md) |
| `@skmtc/gen-shadcn-select` | Searchable select component | [gen-shadcn-select](gen-shadcn-select.md) |
| `@skmtc/gen-shadcn-table` | Data table component | [gen-shadcn-table](gen-shadcn-table.md) |
| `@skmtc/gen-daisyui-form` | React form using DaisyUI (Tailwind) | [gen-daisyui-form](gen-daisyui-form.md) |

### Server-side

Run per OAS operation. Aggregate per-operation handlers into a single
app/router Projection.

| Generator | Output | Reference |
|-----------|--------|-----------|
| `@skmtc/gen-express` | Express route registration | [gen-express](gen-express.md) |
| `@skmtc/gen-supabase-hono` | Hono routes for Supabase Edge Functions | [gen-supabase-hono](gen-supabase-hono.md) |

### GraphQL

Run per GraphQL operation. Designed to be **paired** — running
either alone produces an incomplete file.

| Generator | Output | Reference |
|-----------|--------|-----------|
| `@skmtc/gen-graphql-operation` | `<Op>Args` and `<Op>Result` TS types | [gen-graphql-operation](gen-graphql-operation.md) |
| `@skmtc/gen-graphql-typed-document-node` | `<Op>Document: TypedDocumentNode` constants | [gen-graphql-typed-document-node](gen-graphql-typed-document-node.md) |

## Typical combinations

### Full-stack TypeScript app (REST)

```
@skmtc/gen-typescript           ← static types
@skmtc/gen-zod                  ← runtime validation
@skmtc/gen-tanstack-query-fetch-zod  ← hooks
@skmtc/gen-shadcn-form          ← forms for mutations
```

The three downstream generators (`tanstack-query-*`, `shadcn-form`)
compose with `gen-zod` via `insertNormalizedModel` — the engine
emits a single `userBody` Zod schema even when multiple generators
need it.

### MSW-driven dev workflow

```
@skmtc/gen-typescript
@skmtc/gen-zod
@skmtc/gen-msw                  ← mock handlers
@skmtc/gen-tanstack-query-fetch-zod
```

The form/table generators are optional in this combo — MSW gives
you a backend, the hooks give you fetching, types give you safety.
Add the UI generators when you start prototyping screens.

### Supabase + UI combo

```
@skmtc/gen-typescript
@skmtc/gen-zod
@skmtc/gen-tanstack-query-supabase-zod
@skmtc/gen-shadcn-form
@skmtc/gen-shadcn-select
@skmtc/gen-shadcn-table
```

The UI select/table generators import `isListResponse` directly
from `@skmtc/gen-tanstack-query-supabase-zod` — they're designed to
go together.

### GraphQL contracts + TypedDocumentNode

```
@skmtc/gen-graphql-operation                ← <Op>Args, <Op>Result
@skmtc/gen-graphql-typed-document-node      ← <Op>Document
```

Run them together. The `<Op>Document`'s type parameters reference
the `<Op>Result` and `<Op>Args` types from
`gen-graphql-operation` — running the document generator alone
emits references to types that don't exist.

## How to use these docs

Each per-generator doc is **light by design**. The goal isn't to
exhaustively document every method — the source is short and worth
reading. The docs focus on:

- What it generates (one or two output examples)
- Key decisions and assumptions baked into the source
- What patterns it demonstrates well
- Typical customizations when cloned

When you're considering cloning a generator, read its per-doc page
*and* its `src/mod.ts` together. The doc gives orientation; the
source is authoritative.

## See also

- [Clone vs install concept](../../concepts/clone-vs-install.md) —
  decision tree for whether to clone or install
- [Generators as packages concept](../../concepts/generators-as-packages.md) —
  package shape and lifecycle
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md) —
  the underlying DSL
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md) —
  how the composition cases work
- [`skmtc-generator` skill](../../skills/skmtc-generator/SKILL.md) —
  operational guide for authoring or cloning
