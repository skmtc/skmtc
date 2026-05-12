# @skmtc/gen-express

> Emit Express route registrations from an OpenAPI spec.

An operation generator. Useful when you want to scaffold a typed
server stub that matches your spec. Demonstrates the
**shared-singleton pattern** with `tiny-invariant` for instance
narrowing.

## Source

`skmtc-generators/gen-express/src/`

## What it generates

Per operation, a registration on a shared `app` Projection:

```ts
import express from 'express'

export const app = express()

app.get('/users/:id', (req, res) => {
  // TODO: implement handler
  res.json({ id: req.params.id, name: 'TODO', email: 'TODO' })
})

app.post('/users', (req, res) => {
  const body = userBody.parse(req.body)
  // TODO: implement handler
  res.status(201).json({ ...body, id: 'TODO' })
})
```

All routes accumulate on a single `app` instance per output file.

## Key decisions

- **Single shared `app` Projection.** The entry calls
  `findDefinition({ name: 'app', exportPath })` for each operation.
  If the `app` exists, append the new route. If not, create it
  via `insertOperation` and append. Same pattern as `gen-msw`'s
  `MockRoutesList`, but the accumulator carries the framework's
  router instance, not a list.
- **`tiny-invariant` for instance narrowing.**
  ```ts
  invariant(app?.value instanceof ExpressApp, 'app must be an instance of ExpressApp')
  ```
  TypeScript can't narrow `findDefinition`'s return to the specific
  Projection class — the invariant asserts at runtime and narrows
  for the compiler. This pattern is reusable for any shared-aggregate
  generator.
- **TODO comments survive into output.** Each generated handler
  has a `// TODO` placeholder. Stub-and-edit by design — the
  generator produces a scaffold, not a working server.

## What to learn from it

- **Shared-singleton aggregator pattern.** The accumulator is one
  `ExpressApp` instance (not an array of routes). Every operation's
  `transform` calls `app.append(operation)` to add its route to the
  shared instance. The Projection's `toString()` then emits all
  accumulated routes.
- **`invariant` for type narrowing.** When `findDefinition` returns
  a generic Projection but you need the specific class,
  `tiny-invariant` is the canonical narrowing tool. Don't use
  `as` casts.
- **Stub-and-edit output.** Some generators produce
  ready-to-deploy code; others (like this one) produce scaffolds
  the user customizes. Both are valid styles — pick based on what
  your generator is realistically emitting.

## Common customizations when cloned

- Add middleware insertion (auth, logging, validation).
- Swap Express for another framework (Fastify, Koa) — the
  shared-singleton pattern is unchanged.
- Replace TODO placeholders with delegating calls (e.g.,
  `app.get('/users/:id', userController.getUser)` that imports
  from a hand-written controller module).
- Add automatic request-body validation via the Zod schemas from
  `gen-zod`.

## See also

- [gen-supabase-hono](gen-supabase-hono.md) — same pattern, Hono
  framework
- [gen-msw](gen-msw.md) — shared-aggregate variant
- [API: GenerateContext — findDefinition](../api/generate-context.md)
- [Cross-generator coordination concept](../../concepts/cross-generator-coordination.md)
