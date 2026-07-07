# SKMTC

Generate idiomatic TypeScript source code from an OpenAPI v3 or GraphQL schema. Types, validators, query hooks, mocks, forms, and server routes — all from one schema, in one run, all consistent with each other.

```bash
curl -fsSL https://skm.tc/install | sh
skmtc init my-api ./
skmtc install @skmtc/gen-typescript @skmtc/gen-zod @skmtc/gen-tanstack-query-fetch-zod my-api
skmtc generate my-api ./openapi.json
```

## Where to start

Two paths through SKMTC, depending on what you're trying to do:

- **[Using SKMTC](using/)** — installing generators, configuring projects, running generation, integrating with CI. This is the right path for most people.
- **[Extending SKMTC](extending/)** — cloning, customizing, or authoring generators. This is the right path when stock defaults don't match your conventions.

If you're not sure which applies, keep reading this page for the overview, then pick a tree.

---

## What you get

Given an OpenAPI operation:

```yaml
paths:
  /users:
    post:
      operationId: createUser
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required: [name, email]
              properties:
                name: { type: string }
                email: { type: string, format: email }
                role: { type: string, enum: [admin, user] }
```

…SKMTC produces (with the right generators installed) five coherent artifacts:

| File | Generator | Purpose |
|---|---|---|
| `CreateUserBody.ts` | gen-typescript | Request body type |
| `createUserBody.ts` | gen-zod | Runtime validator |
| `services/useCreateUser.generated.ts` | gen-tanstack-query-fetch-zod | Mutation hook |
| `forms/CreateUserForm.generated.tsx` | gen-shadcn-form | Wired React form |
| `mocks/createUser.ts` | gen-msw | Test handler |

One schema, five files. Add a field, regenerate, all five update consistently. Full example: [`using/recipes/full-stack-typescript-app.md`](using/recipes/full-stack-typescript-app.md).

---

## When to use SKMTC

**Strong fit:**
- You have an OpenAPI v3 or GraphQL schema as your contract.
- You need *multiple* artifact types from that schema.
- You want generated code committed to your repo (readable, grep-able).

**Probably overkill:**
- You only need types → [`openapi-typescript`](https://github.com/openapi-ts/openapi-typescript).
- You only need a typed fetch client → [`@hey-api/openapi-ts`](https://heyapi.dev/).
- Your schemas are dynamic at runtime → a runtime renderer.

**Wrong tool:**
- You can't install Deno (the CLI runs on Deno; output runs anywhere).
- You're not on a TypeScript stack.

See [`explanation/comparison-to-other-tools.md`](explanation/comparison-to-other-tools.md).

---

## Quick start

1. Install the CLI: `curl -fsSL https://skm.tc/install | sh`
2. Create a project: `skmtc init my-api ./`
3. Install generators: `skmtc install @skmtc/gen-typescript @skmtc/gen-zod my-api`
4. Configure a schema source in `.skmtc/my-api/.settings/client.json`
5. Generate: `skmtc generate my-api`

Full walkthrough: [`using/tutorials/01-your-first-generation.md`](using/tutorials/01-your-first-generation.md).

---

## How it works

```
CLI: Bootstrap → Pre-parse OAS ──┐
                                 │
Worker:        Parse → Generate → Render
                                 │
CLI:    ◀──────── Persist files ◀┘
```

- **Parse:** schema → typed object model; per-item failures isolated.
- **Generate:** walk generators; memoized Drivers coordinate cross-generator dependencies.
- **Render:** serialize to `{ path: content }` strings. (No Prettier — consumers format their own output.)

Generators are TypeScript classes you `install` from JSR or `clone` into your project for editing. See [`concepts/the-three-phases.md`](concepts/the-three-phases.md).

---

## The customization model

| | **Install** | **Clone** |
|---|---|---|
| Command | `skmtc install @skmtc/gen-zod` | `skmtc clone <project> -g @skmtc/gen-zod` |
| Source | JSR (remote) | local to your project |
| Customization | Enrichments only | Edit any code |
| When | Stock defaults are fine | You need different paths, naming, or peer deps |

Same philosophy as shadcn/ui: not a configurable dependency, but vendored source you own. See [`concepts/clone-vs-install.md`](concepts/clone-vs-install.md).

---

## Documentation

Pick the tree that matches your role; the shared layers work for both.

### Role-specific trees

- **[`using/`](using/)** — installing, configuring, running, integrating
  - [Tutorials](using/tutorials/) · [How-to](using/how-to/) · [Recipes](using/recipes/)
- **[`extending/`](extending/)** — cloning, customizing, authoring
  - [Tutorials](extending/tutorials/) · [How-to](extending/how-to/) · [Recipes](extending/recipes/)

### Shared layers

- **[`concepts/`](concepts/)** — mental models (Projections, Snippets, the pipeline, refs, idempotency)
- **[`reference/`](reference/)** — CLI commands, settings schema, API, stock generators
- **[`explanation/`](explanation/)** — design rationale, comparisons, security model, roadmap

---

## Stock generators

| Generator | Output | Typical companions |
|---|---|---|
| `@skmtc/gen-typescript` | TypeScript types | (base) |
| `@skmtc/gen-zod` | Zod schemas | gen-typescript |
| `@skmtc/gen-valibot` | Valibot schemas | gen-typescript |
| `@skmtc/gen-arktype` | Arktype schemas | gen-typescript |
| `@skmtc/gen-msw` | MSW handlers | gen-zod |
| `@skmtc/gen-tanstack-query-fetch-zod` | Tanstack Query hooks (fetch) | gen-typescript, gen-zod |
| `@skmtc/gen-tanstack-query-supabase-zod` | Tanstack Query hooks (Supabase) | gen-typescript, gen-zod |
| `@skmtc/gen-shadcn-form` | React forms (shadcn) | gen-zod, gen-tanstack-query-* |
| `@skmtc/gen-shadcn-select` | React select fields | gen-shadcn-form |
| `@skmtc/gen-shadcn-table` | React data tables | gen-tanstack-query-* |
| `@skmtc/gen-daisyui-form` | React forms (DaisyUI) | gen-zod |
| `@skmtc/gen-express` | Express route handlers | gen-typescript, gen-zod |
| `@skmtc/gen-supabase-hono` | Hono routes for Supabase | gen-typescript, gen-zod |

Per-generator reference: [`reference/stock-generators/`](reference/stock-generators/).

---

## FAQ

**Is SKMTC production-ready?** Engine and CLI are stable. Stock generators vary in maturity — TypeScript / Zod / Tanstack Query are well-tested; GraphQL pipeline is less battle-tested. See [`explanation/status-and-roadmap.md`](explanation/status-and-roadmap.md).

**Does SKMTC format the output?** No. Run Prettier or Biome as a separate step.

**Can I use SKMTC alongside another codegen tool?** Yes. SKMTC writes only to `basePath`.

**Swagger 2 or OpenAPI 3.1?** Normalized to OAS 3.0 via `@skmtc/convert`. Both work.

**What's the runtime cost?** Zero SKMTC-specific runtime. Output uses whatever libraries the chosen generators target.

**Are generators sandboxed?** Yes — `net: false`, `run: false` in the Worker. Can read env vars. See [`explanation/security-model.md`](explanation/security-model.md).

**Is there a hosted version?** Yes — `skmtc generate` can route to a remote Sandbox API. See [`using/recipes/`](using/recipes/).

---

## For AI coding assistants

If you are a coding assistant, read [`llms.md`](llms.md) — a primer optimized for your reading patterns. Also: `skmtc agent-context --json` produces a structured project state dump.

---

## Project status

- **Stable:** three-phase pipeline, DSL (Projection / Snippet / Definition), CLI command surface, OAS object model.
- **Active:** import rendering under `verbatimModuleSyntax`, enrichment schema improvements.
- **Experimental:** GraphQL pipeline, hosted Sandbox API.

See [`explanation/status-and-roadmap.md`](explanation/status-and-roadmap.md).

---

## Community

- **Source:** https://github.com/skmtc/skmtc *(placeholder)*
- **Issues & discussions:** GitHub
- **Contributing:** [`CONTRIBUTING.md`](../CONTRIBUTING.md)

## License

The engine (`@skmtc/core`), CLI (`@skmtc/cli`), and other `skmtc/` packages are licensed under **Apache 2.0**. See [`../LICENSE`](../LICENSE).

Stock generators (`skmtc-generators/gen-*`) are licensed under **MIT**. See [`../../../skmtc-generators/LICENSE.md`](../../../skmtc-generators/LICENSE.md).
