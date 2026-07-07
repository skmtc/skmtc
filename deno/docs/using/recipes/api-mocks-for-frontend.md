# API mocks for frontend development

> Drive frontend development against MSW mocks generated from
> your backend's OpenAPI schema — schema-first, no backend
> required.

## What you'll build

A frontend project that runs against generated MSW mock handlers
in development mode. When the backend's spec changes, you
regenerate; your dev server's mock layer updates without writing
fixtures by hand.

## Stack

- Vite / Next.js / Astro (any modern frontend)
- MSW for mock service worker
- The backend's OpenAPI spec (no backend running)

## Setup

```bash
skmtc init my-frontend src/generated
skmtc install @skmtc/gen-typescript my-frontend
skmtc install @skmtc/gen-zod my-frontend
skmtc install @skmtc/gen-msw my-frontend
skmtc install @skmtc/gen-tanstack-query-fetch-zod my-frontend
```

`.skmtc/my-frontend/.settings/client.json`:

```jsonc
{
  "source": "https://api.example.com/openapi.json",
  "settings": {
    "basePath": "src/generated"
  }
}
```

Generate:

```bash
skmtc generate my-frontend
```

## Step-by-step

### Generate MSW handlers

The `gen-msw` generator produces one `http.get` / `http.post` /
etc. handler per operation, plus a shared `toRoutesList(deps)`
factory that returns the array MSW's `setupWorker` expects.

Default response bodies come from the spec's `example` field (if
present) or are synthesized from the schema. For
mutation-and-list patterns, you'll typically supply a mock data
store via the `deps` argument.

### Wire MSW in the dev server

```ts
// src/setupMsw.ts
import { setupWorker } from 'msw/browser'
import { toRoutesList } from '@/generated/mocks.generated.ts'

const mockStore = {
  pets: [{ id: 1, name: 'Fluffy' }, { id: 2, name: 'Rex' }],
  users: []
}

export const worker = setupWorker(...toRoutesList({ store: mockStore }))
```

Start MSW conditionally in development:

```ts
// src/main.tsx (or _app.tsx, etc.)
if (import.meta.env.DEV) {
  const { worker } = await import('./setupMsw.ts')
  await worker.start()
}
```

### Iterate with the schema as source of truth

When the backend team updates the OpenAPI spec:

```bash
skmtc generate my-frontend
```

The MSW handlers update automatically. The hooks update. The Zod
schemas update. Your dev server reloads with the new shapes.

The Zod schemas validate the mock responses against the spec —
if you accidentally diverge (e.g., a mock store entry missing a
required field), the validation throws a clear error in the
browser console.

## Result

Frontend development is unblocked from backend availability. The
team can iterate on UI and types against generated mocks while
the backend implementation catches up. When the real backend is
ready, swap MSW out by gating the import on
`import.meta.env.DEV`.

## Variations

- **Realistic data via Faker.** The stock generator uses spec
  examples; for richer mock data, clone `gen-msw` and have it
  produce `@faker-js/faker` calls based on schema shapes (string
  format `email` → `faker.internet.email()`, etc.).
- **Stateful mocks.** The stock `toRoutesList(deps)` factory
  accepts a `deps` object — pass an in-memory data store with
  `add`/`update`/`remove` methods to make POST/PUT/PATCH
  handlers actually mutate state, not just echo responses.
- **Per-operation overrides.** Need specific operations to
  return errors (testing error paths)? Override per-route in your
  `setupWorker` call rather than touching the generator.

## Source

The MSW-driven workflow is one of the highest-value SKMTC
use cases — schema-first frontend development without a running
backend. Stock generators cover ~80% of the need; the remaining
20% is typically swapping in realistic data generation or making
mocks stateful, both small clone-targets.

## See also

- [`gen-msw` reference](../../reference/stock-generators/gen-msw.md)
- [Recipe: Full-stack TypeScript app](full-stack-typescript-app.md)
- [Tutorial 02: Multiple generators](../tutorials/02-multiple-generators.md)
