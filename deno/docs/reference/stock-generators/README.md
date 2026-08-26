# Stock generators reference

> Per-generator reference for the generators shipped under
> `@skmtc/gen-*` — what each produces, its enrichments, and its clone
> seams.

New here? Read the [overview](overview.md) for what the stock generators
are and how to use them as starting points to clone and edit.

## Catalog

| Generator | Produces |
| --- | --- |
| [`@skmtc/gen-typescript`](gen-typescript.md) | TypeScript `type` aliases from OpenAPI schemas and GraphQL types |
| [`@skmtc/gen-zod`](gen-zod.md) | Zod validation schemas from OpenAPI schemas |
| [`@skmtc/gen-valibot`](gen-valibot.md) | Valibot validation schemas from OpenAPI schemas |
| [`@skmtc/gen-arktype`](gen-arktype.md) | ArkType validation schemas from OpenAPI schemas |
| [`@skmtc/gen-msw`](gen-msw.md) | MSW (Mock Service Worker) route handlers for an OpenAPI spec |
| [`@skmtc/gen-express`](gen-express.md) | Express route registrations from an OpenAPI spec |
| [`@skmtc/gen-supabase-hono`](gen-supabase-hono.md) | Hono route registrations targeting Supabase Edge Functions |
| [`@skmtc/gen-tanstack-query-fetch-zod`](gen-tanstack-query-fetch-zod.md) | Tanstack Query hooks (`useQuery`, `useMutation`) with `fetch` and Zod |
| [`@skmtc/gen-tanstack-query-supabase-zod`](gen-tanstack-query-supabase-zod.md) | Tanstack Query hooks using Supabase's Postgrest-style client |
| [`@skmtc/gen-shadcn-form`](gen-shadcn-form.md) | React form components using shadcn/ui form primitives |
| [`@skmtc/gen-shadcn-select`](gen-shadcn-select.md) | React searchable-select component sourced from a GET endpoint |
| [`@skmtc/gen-shadcn-table`](gen-shadcn-table.md) | React data-table component sourced from a GET list-response endpoint |

## Not in this reference

The `@skmtc/gen-*` scope has a few more members. They are absent here
because they are pre-alpha, internal tooling, or younger siblings of a
documented generator — not because they are secret:

- `@skmtc/gen-daisyui-form` — form generator over daisyUI; the younger
  sibling of [gen-shadcn-form](gen-shadcn-form.md)
- `@skmtc/gen-typescript-s` and `@skmtc/gen-typescript-sdk` — a
  configurable-scalars variant of [gen-typescript](gen-typescript.md),
  and an enrichment-driven SDK resource-class generator
- `@skmtc/gen-md-docs` — per-operation markdown documentation
  (internal tooling for search indexing)
- `@skmtc/gen-kotlin-jackson`, `@skmtc/gen-kotlin-spring` — private,
  pre-alpha Kotlin track; not published
- `@skmtc/gen-ts-webhook` — one handler type per OpenAPI 3.1 webhook;
  covered as the worked example in
  [webhook generators](../api/webhook-generators.md)
