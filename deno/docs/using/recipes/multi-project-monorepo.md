# Multi-project monorepo

> One repo, multiple SKMTC projects writing into separate output
> directories — useful when you have several APIs or multiple
> consumer apps with different generator combinations.

## What you'll build

A workspace with two or more SKMTC projects under `.skmtc/`,
each with its own spec source, its own generator set, and its
own output directory. One CLI install, one Deno install,
multiple independent generation runs.

## Stack

- A monorepo (pnpm/npm/yarn workspaces, Turborepo, Nx, or plain
  Deno workspace — any layout)
- 2+ OpenAPI specs (or one OAS + one GraphQL)
- Per-project generator combinations

## Setup

A typical layout:

```
my-monorepo/
├── deno.json                          # workspace deno.json
├── packages/
│   ├── customer-api/                  # consumer 1
│   │   └── src/generated/             # output target for project "customer-api"
│   └── admin-api/                     # consumer 2
│       └── src/generated/             # output target for project "admin-api"
└── .skmtc/
    ├── customer-api/
    │   ├── deno.json                  # generators for project "customer-api"
    │   └── .settings/client.json
    └── admin-api/
        ├── deno.json                  # different generators for project "admin-api"
        └── .settings/client.json
```

## Step-by-step

### Initialize multiple projects

```bash
skmtc init customer-api packages/customer-api/src/generated
skmtc init admin-api packages/admin-api/src/generated
```

Each gets its own `.skmtc/<project>/` directory with its own
`deno.json` (generator imports) and `client.json` (settings).

### Configure each project's source

`init` already wrote each project's `basePath`. Add the `source` so each
`client.json` reads:

```jsonc
// .skmtc/customer-api/.settings/client.json
{
  "source": "https://api.example.com/customer-api.json",
  "settings": {
    "basePath": "packages/customer-api/src/generated"
  }
}
```

```jsonc
// .skmtc/admin-api/.settings/client.json
{
  "source": "https://api.example.com/admin-api.json",
  "settings": {
    "basePath": "packages/admin-api/src/generated"
  }
}
```

`basePath` is relative to the workspace root, so each project's
output lands inside its respective `packages/` subdirectory.

### Install per-project generators

Each project can have a different generator combination:

```bash
# customer-api: end-user-facing UI
skmtc install @skmtc/gen-typescript customer-api
skmtc install @skmtc/gen-zod customer-api
skmtc install @skmtc/gen-tanstack-query-fetch-zod customer-api
skmtc install @skmtc/gen-shadcn-form customer-api

# admin-api: internal tooling, no forms needed
skmtc install @skmtc/gen-typescript admin-api
skmtc install @skmtc/gen-zod admin-api
skmtc install @skmtc/gen-tanstack-query-fetch-zod admin-api
```

The two projects share no state. Generator versions can differ
per project.

### Coordinate generation in CI

Run both:

```bash
skmtc generate customer-api
skmtc generate admin-api
```

Or in parallel:

```bash
skmtc generate customer-api &
skmtc generate admin-api &
wait
```

Each invocation spawns its own Worker; they don't share memory
or state. Output goes to each project's `basePath`.

## Result

Each `packages/*/src/generated/` has its own coherent set of
artifacts matching its own API. Both packages import from their
local `src/generated/` — no cross-package generated imports.
Updating one API regenerates one project; the other is untouched.

## Variations

- **Different schemas for the same generators.** Two projects
  could install the same generator set but point at different
  specs — useful when you have v1 and v2 of an API in parallel.
- **Mixed OAS and GraphQL.** One project handles your REST API
  (OAS), another handles your GraphQL endpoint. The CLI
  dispatches by document type.
- **Shared cloned generators.** If both projects want the same
  customized generator, clone it once at the workspace root and
  symlink (or just use the same path in each project's
  `deno.json#imports`). See [recipe: design system across many
  APIs](../../authoring/recipes/design-system-across-many-apis.md).
- **CI per-project triggering.** Use a path-filter in CI (only
  regenerate `customer-api` when the customer spec changes) to
  avoid noise on unrelated changes.

## Source

The multi-project model is what `.skmtc/<project>/` is designed
for. The CLI commands all take `<project>` as an argument; no
single-project assumption is baked in.

## See also

- [`skmtc init` reference](../../reference/cli/init.md)
- [Projects and workspaces concept](../../concepts/projects-and-workspaces.md)
- [How to use SKMTC in CI/CD](../how-to/use-in-ci-cd.md)
