# Design system across many APIs

> Architectural pattern for sharing a customized generator set
> across multiple APIs (multiple projects, multiple repos, or
> multiple teams).

## What you'll build

A set of cloned, customized generators that encode your team's
house style (naming conventions, output paths, component
imports), shared across multiple SKMTC projects. New APIs adopt
the design system by referencing the shared clones — no
per-project re-customization.

## Stack

- 2+ SKMTC projects (in the same workspace, multiple workspaces,
  or multiple repos)
- One source of truth for the cloned generator code
- The shared clones cover everything that varies "by team house
  style"; per-API enrichments cover everything that varies "by
  API"

## Setup

Pick a location for the shared clones. Three common patterns:

1. **Within one workspace.** Clone once at workspace root, used
   by all projects in that workspace via local imports.
2. **Across workspaces.** Publish the customized generators to
   a private JSR scope (e.g., `@yourorg/gen-zod`) and install
   into each workspace.
3. **As a git submodule.** Add the customized generator source
   as a git submodule in each consuming workspace.

This recipe uses pattern 1 (single workspace) for concreteness;
patterns 2 and 3 are mentioned in [variations](#variations).

## Step-by-step

### Clone the foundational generators

```bash
# In the workspace root
skmtc clone shared \
  -g @skmtc/gen-typescript \
  -g @skmtc/gen-zod \
  -g @skmtc/gen-shadcn-form
```

This creates a `.skmtc/shared/` project with three cloned
generators. The "shared" project isn't a real consumer — it's a
holding area for the customized source.

### Encode house style in `toIdentifier` and `toExportPath`

Open each cloned generator's `src/base.ts` and apply your house
style:

```ts
// .skmtc/shared/gen-zod/src/base.ts
import { Identifier, capitalize } from '@skmtc/core'

// House style: PascalCase with "Schema" suffix
export const toIdentifier = ({ refName }) =>
  createVariable(`${capitalize(refName)}Schema`)

// House style: per-domain subdirectories
export const toExportPath = ({ refName }) => {
  const domain = inferDomain(refName)
  return `/${domain}/${refName}.schema.ts`
}

function inferDomain(refName: string): string {
  if (refName.startsWith('User') || refName.startsWith('Auth')) return 'identity'
  if (refName.startsWith('Order') || refName.startsWith('Cart')) return 'commerce'
  return 'shared'
}
```

Apply similar customizations to the form generator's import
paths, the TypeScript generator's `interface` vs `type` choice,
etc.

### Share the cloned generators across projects

Reference the shared generators from each consumer project's
`deno.json#imports`:

```jsonc
// .skmtc/customer-app/deno.json
{
  "imports": {
    "@local/gen-zod": "../shared/gen-zod/mod.ts",
    "@local/gen-typescript": "../shared/gen-typescript/mod.ts",
    "@local/gen-shadcn-form": "../shared/gen-shadcn-form/mod.ts"
  }
}
```

Each consumer project imports the same shared source. Editing
the shared generator updates all consumers after a rebundle.

### Per-API enrichments

The consuming projects' `client.json` carries per-API
customization that goes into the shared schema's enrichment
fields:

```jsonc
// .skmtc/customer-app/.settings/client.json
{
  "source": "https://api.example.com/customer-api.json",
  "settings": {
    "basePath": "packages/customer-app/src/generated",
    "enrichments": {
      "@local/gen-shadcn-form": {
        "/users": {
          "post": { "title": "Sign up" }
        }
      }
    }
  }
}
```

The shared generator's logic doesn't change per-consumer; only
the enrichment data does.

## Result

A team can add a new API to the design system by:

1. `skmtc init <new-api>`
2. Update `.skmtc/<new-api>/deno.json#imports` to reference the
   shared generators
3. Set `.skmtc/<new-api>/.settings/client.json#source` to the
   new API's spec
4. (Optional) Add per-operation enrichments
5. `skmtc generate <new-api>`

The output follows the house style automatically. No
re-customization, no copy-paste of generator source.

## Variations

- **Private JSR scope.** Publish the customized generators to
  `@yourorg/gen-*` on a private JSR instance. Consumer projects
  install via `skmtc install` like any other JSR generator.
  Best when consumer projects live in different repos.
- **Git submodule.** Add the customized generator source as a
  git submodule in each consumer repo. Each consumer pins to a
  specific submodule revision.
- **Tiered house style.** Have a small "core" of shared
  customizations and a larger "per-domain" layer that consumer
  projects override. Implemented via inheritance in the
  Projection classes (consumer project clones the
  shared clone and edits further).
- **Generator-specific clone, generic schema.** Sometimes only
  one or two generators need house-style customization; the
  rest stay as stock JSR. Mix-and-match: cloned customs for
  forms, stock for schemas.

## Source

The "design system as cloned generator" pattern is the most
mature SKMTC usage pattern. The key insight: customization
belongs in source, not config. Config (enrichments) handles
per-instance variation; cloning handles per-team variation.

## See also

- [How to change export paths](../how-to/change-export-paths.md)
- [How to change identifier conventions](../how-to/change-identifier-conventions.md)
- [Clone vs install concept](../../concepts/clone-vs-install.md)
- [Why clone-to-customize](../../explanation/why-clone-to-customize.md)
- [Recipe: Multi-project monorepo](../../using/recipes/multi-project-monorepo.md) —
  the user-side perspective on multi-project workspaces
