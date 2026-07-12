# @skmtc/gen-msw

> Produce MSW (Mock Service Worker) route handlers for an OpenAPI spec.

An operation generator that demonstrates the **shared-aggregate
pattern**: one Projection per operation contributes a route, and
all routes converge into a single `routesList` Projection per file.

## What it generates

Per operation, a `MockRoute`:

```ts
const getUserRoute = http.get('/users/:id', () => HttpResponse.json({ ... }))
```

Plus a shared aggregator `MockRoutesList` in the same file:

```ts
export const toRoutesList = (deps: { ... }) => [
  getUserRoute,
  createUserRoute,
  // ... all per-operation routes
]
```

The `toRoutesList` factory accepts dependencies (typically your
mock data store) and returns the array MSW expects.

## Source

`skmtc-generators/gen-msw/src/`

## Key decisions

- **Shared aggregate via `findDefinition` + `defineAndRegister`.**
  The entry checks whether a `toRoutesList` already exists in the
  target file (`findDefinition({ name, exportPath })`). If yes,
  append the new route to its existing instance. If no, create one
  with `defineAndRegister` and append. This is the canonical
  pattern for "one Projection collects contributions from many."
- **Factory-of-routes, not a const array.** The aggregator produces a
  function so consumers can inject deps. This sidesteps the
  "module-level array of handlers needs a data store but data
  stores are created later" timing problem.
- **No filtering via `isSupported`.** All operations get a mock —
  GETs, POSTs, DELETEs, etc.

## What to learn from it

- **The shared-aggregate pattern.** When you want one "index" file
  that lists all per-operation outputs, this is the template.
  Variants: `gen-express` and `gen-supabase-hono` use the same
  pattern with `tiny-invariant`-based assertions.
- **`findDefinition` for idempotent aggregator creation.** Looking
  up by `(name, exportPath)` lets multiple `transform()` calls
  converge on the same accumulator without races.
- **Returning a factory.** When generated output needs runtime
  dependencies, produce a function not a const. The consumer wires
  the deps at boot time.

## Common customizations when cloned

- Swap MSW for a different mock library (e.g., Nock, Pollyjs).
- Change the response-shape generator (the stock produces
  `HttpResponse.json({...})` from an example or a synthesized
  object; you may want to delegate to a fixture system).
- Customize the path-parameter substitution (`/users/:id`
  conversions are stock OAS-to-Express style; some routers use
  `{id}` instead).
- Change the aggregator's shape (return a `Map`, or a record by
  operationId, instead of an array).

## See also

- [API: GenerateContext — findDefinition / defineAndRegister](../api/generate-context.md)
- [gen-express](gen-express.md) — same shared-aggregate pattern,
  different aggregator shape
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md)
- [Projections and Snippets concept](../../concepts/projections-and-snippets.md)
