# @skmtc/gen-supabase-hono

> Produce Hono route registrations targeting Supabase Edge Functions.

An operation generator. The Hono-and-Supabase counterpart to
`gen-express`. Same shared-singleton pattern, different framework
and runtime target.

## Source

`skmtc-generators/gen-supabase-hono/src/`

## What it generates

A Hono app with per-operation routes:

```ts
import { Hono } from 'hono'

export const app = new Hono()

app.get('/users/:id', async (c) => {
  const { id } = c.req.param()
  // TODO: implement
  return c.json({ id, name: 'TODO' })
})

app.post('/users', async (c) => {
  const body = userBody.parse(await c.req.json())
  // TODO: implement
  return c.json({ ...body, id: 'TODO' }, 201)
})
```

## Key decisions

- **Identical entry shape to `gen-express`.** Same `findDefinition`
  + `insertOperation`-or-append flow, same `tiny-invariant`
  narrowing of `app?.value instanceof SupabaseHono`. The variation
  is in `SupabaseHono.append()` — produces Hono-style routes instead
  of Express-style.
- **Hono context, not request/response.** Hono routes receive a
  `Context` object (`c`) with `c.req`, `c.json`, etc. — different
  shape from Express's `(req, res)`. The Projection's `toString()`
  produces Hono idioms.
- **Targets the Edge runtime.** Designed for Supabase Edge
  Functions specifically. Most decisions (e.g., `await c.req.json()`,
  ESM-style exports) reflect the Edge runtime's constraints.

## What to learn from it

- **A second instance of the shared-singleton pattern.** Comparing
  with `gen-express` shows exactly what changes when you fork a
  shared-singleton generator for a different framework: the
  Projection class is renamed, the per-operation rendering style
  changes, the entry stays the same.
- **Framework-specific idiom adaptation.** Both Express and Hono
  do "register a route," but the per-route code shape differs.
  The Projection encapsulates these differences — the entry
  pattern is reusable.

## Common customizations when cloned

- Target a different Hono-compatible runtime (Cloudflare Workers,
  Deno Deploy, Vercel Edge) — the route registration code is the
  same; deployment differs.
- Add Supabase RLS handling (extract auth from the request, pass
  to Postgrest queries).
- Add middleware (auth, CORS, logging) — Hono has middleware
  composition built in.
- Replace TODO handlers with delegating calls to controllers.

## See also

- [gen-express](gen-express.md) — same pattern, different framework
- [gen-msw](gen-msw.md) — shared-aggregate variant with a list
  accumulator instead of a singleton
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md)
