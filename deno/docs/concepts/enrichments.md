# Enrichments

> The configuration surface declared by each generator via a Valibot schema and
> supplied by users in `client.json`. Enrichments are the _configurability_
> lever of the customization gradient — the narrow tweaks that don't require
> cloning. An enrichment is a generator-owned opaque leaf at one of three
> **scopes** — `subject`, `generator`, `stack` — distinguished by key depth in
> `client.json#settings.enrichments`.

Enrichments are how stock generators expose user-facing options without
compromising the clone-to-customize philosophy. A generator declares what
payload it accepts (one composite Valibot schema spanning the three scopes). A
user supplies values at a key whose depth selects the scope (in `client.json`).
The engine assembles the three scopes into a single
`{ subject, generator, stack }` umbrella and delivers the validated value to the
Projection.

## What enrichments are (and aren't)

Enrichments **are**:

- User overrides at one of three scopes — per-item (`subject`), per-generator
  (`generator`), or per-composition (`stack`)
- Declared per-generator via a single composite Valibot schema
- Validated at parse time
- Supplied by the user in `.settings/client.json`
- Available at generation time as the
  `this.settings.enrichments.{subject,generator,stack}` umbrella inside a
  Projection

Enrichments **are not**:

- A general configuration system for _all_ customization
- A replacement for cloning when you need behavioral changes
- A way to change identifier naming, export paths, or output template structure
  (those are clone-time changes)
- A filter for which operations the generator runs against

The mental model: enrichments are the inputs the _author_ of a generator decided
to make user-configurable. Everything else stays hardcoded as the clone seam.

## The three scopes

An enrichment is a generator-owned opaque leaf at one of three scopes. The scope
is selected by **how deep its key sits** in `client.json#settings.enrichments`:

| Scope         | Key path                 | Varies       | What it's for                                                                                                       |
| ------------- | ------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| **subject**   | `[id][subject][variant]` | per item     | The original per-operation / per-model override — one value per `(refName)` or `(path, method)`, resolved per item. |
| **generator** | `[id]._generator`        | run-constant | A single bag for one generator across the whole run — the generator's own knobs that don't vary per item.           |
| **stack**     | `._stack`                | run-constant | A single bag shared across _every_ generator in the composition — one value the whole stack reads.                  |

- `subject` is the enrichment that has always existed: its storage
  (`[id][subject][variant]`) is **unchanged**. What's new is that it's now one
  member of a three-scope umbrella.
- `generator` lives inside a generator's own slot, alongside its subject keys,
  under the reserved key `_generator`.
- `stack` lives at the top level of the enrichments record, a sibling of the
  generator-id keys, under the reserved key `_stack`.

### Reserved keys are `_`-prefixed

The two run-constant scopes use **reserved** keys. The rule:

- `_stack` — the only reserved _top-level_ key (sibling of generator ids).
- `_generator` — the only reserved _per-generator_ key (sibling of subject
  names).
- Every other key is a **customer** key — a generator id at the top level, a
  subject name inside a slot — and **must not start with `_`**.

Core's single predicate is the source of truth:

```ts
// core/types/Enrichments.ts
export const isReservedEnrichmentKey = (key: string): boolean =>
  key.startsWith("_");
```

The reserved-key segregation is a core / migration concern only — generators
never iterate enrichments themselves. They read each scope by known key through
the typed umbrella (`ContentSettings`) or the helper readers (everywhere else),
so they can't trip over the reserved keys.

## Core owns the hierarchy; the generator owns the leaf

The design fact that explains everything else on this page: core's top-level
type for enrichments (`core/types/Enrichments.ts`) is

```ts
type GeneratorEnrichments = Record<
  string,
  ModelEnrichments | OasPathEnrichments | GqlRootKindEnrichments
>;
```

Each generator-id slot is a subject hierarchy ending in
`EnrichmentLeaf = unknown` (plus the optional reserved `_generator` leaf); the
reserved top-level `_stack` key holds the stack leaf. Core's Valibot schema
types every leaf as `v.unknown()`. **There is no canonical enrichment leaf shape
in core** — at any of the three scopes.

The leaf shapes live entirely in the generator's `toEnrichmentSchema()`. The
engine hands a generator the unparsed leaf at each scope's key; the generator's
own composite Valibot schema decides what shape is acceptable for `subject`,
`generator`, and `stack`.

Two consequences worth knowing:

- **Different generators at the same routing key never collide.**
  `enrichments['@skmtc/gen-shadcn-form']['/users']['post']` and
  `enrichments['@skmtc/gen-msw']['/users']['post']` can have completely
  different shapes. Each generator reads only its own slice and parses only
  against its own schema.
- **Adding a new enrichment field is a purely local change.** Generators can
  extend their own schemas independently — no coordinated core update, no
  canonical schema to maintain. This is what makes the
  clone-and-add-an-enrichment path viable for forks.

The split is also what lets enrichments stay an _opaque_ lever for core while
being a _fully-typed_ one for the generator's own constructor.

## Where enrichments live

User-supplied enrichments go in `client.json`. Key depth selects the scope. The
subject scope's routing keys under each generator depend on the generator's
projection-base kind; the payload shape _under_ the leaf-locating keys is
defined by the generator's Valibot schema (see
[routing structure](#the-routing-structure) below):

```json
{
  "source": "./openapi.json",
  "settings": {
    "basePath": "src/generated",
    "enrichments": {
      "_stack": { "apiTitle": "Acme API" },
      "@skmtc/gen-shadcn-form": {
        "_generator": { "defaultSubmitLabel": "Save" },
        "/contacts": {
          "post": {
            "main": {
              "title": "Create Contact",
              "submitLabel": "Save",
              "fields": [
                {
                  "id": "officeIds",
                  "references": "GetOffices",
                  "referenceKind": "searchable",
                  "label": "Offices"
                }
              ]
            }
          }
        }
      }
    }
  }
}
```

Three scopes are visible here:

- `_stack` — top-level reserved key; one bag shared across every generator in
  the composition.
- `["@skmtc/gen-shadcn-form"]._generator` — per-generator reserved key; one bag
  for this generator.
- `["@skmtc/gen-shadcn-form"]["/contacts"].post.main` — the subject leaf.
  `/contacts` and `post` are the **routing** keys (the engine navigates these),
  `main` is the variant; everything beneath is the **payload** shape declared by
  the generator's Valibot schema.

## The routing structure

Routing applies to the **subject** scope only — the per-item leaf. (The
`generator` and `stack` scopes are run-constants at fixed reserved keys; they
aren't routed by item.) Each projection-base factory hardcodes its own
`get(context.settings, ...)` lookup for the subject leaf. There are three
shapes:

| Factory                        | Subject path read                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `toOasOperationProjectionBase` | `enrichments.${generatorId}.${operation.path}.${operation.method}.${variant}`        |
| `toModelProjectionBase`        | `enrichments.${generatorId}.${refName}.${variant}`                                   |
| `toGqlOperationProjectionBase` | `enrichments.${generatorId}.${operation.rootKind}.${operation.fieldName}.${variant}` |

(These are core's own factory names. Generators don't call them directly — they
wire up through their language package's veneer: `toTsModelProjectionBase` /
`toTsOasOperationProjectionBase` / `toTsGqlOperationProjectionBase` from
`@skmtc/lang-typescript`, and the `toKt*` / `toCs*` equivalents in the Kotlin
and C# lang packages.)

Specifically:

- **OAS operation generators** route by
  `(operation.path, operation.method, variant)` — the literal OpenAPI path,
  lowercase HTTP verb, and variant name.
- **Model generators** route by `(refName, variant)` — the component name as it
  appears under `components.schemas`, plus variant name.
- **GraphQL operation generators** route by `(rootKind, fieldName, variant)` —
  `"query" | "mutation" | "subscription"` (lowercase), the operation field, and
  variant name.

The trailing `variant` level defaults to `'main'` when the consumer declares no
variants. Whenever any variant is declared, `'main'` MUST be present (the engine
throws via `toVariantList` otherwise). See [`variants.md`](./variants.md).

There is no `operationId`-based routing for OAS, and no separate "projection
kind" or "projection key" routing level. Beneath the engine-routed keys, the
leaf value's shape is whatever the generator's Valibot schema declares — see
[enrichments-shape reference](../reference/settings/enrichments-shape.md) for
the actual routing details and complete examples.

## How routing works at generate time

For each Projection the engine builds:

1. The factory's static
   `toEnrichments({ operation | refName, context, variant })` runs.
2. It reads the **raw umbrella** from the three storage spots:
   - `subject` —
     `get(context.settings, ['enrichments', id, <subject…>, variant])` at the
     path shown in the routing table for that projection-base kind.
   - `generator` — `get(context.settings, ['enrichments', id, '_generator'])`.
   - `stack` — `get(context.settings, ['enrichments', '_stack'])`.
3. The `{ subject, generator, stack }` raw object is parsed **once** through the
   generator's composite `toEnrichmentSchema()` —
   `v.parse(config.toEnrichmentSchema(), raw)`. Because the composite schema is
   required, this parse is cast-free.
4. The parsed umbrella is delivered as `settings.enrichments` to the Projection.

`toEnrichments` is generated by the factory; you don't write it manually. The
single `EnrichmentType` generic on the projection chain now _means_ this
`{ subject, generator, stack }` umbrella — the chain stays single-param; there
are no new type parameters per scope.

## The relationship to clone-vs-install

Enrichments fit in the middle of the customization gradient:

```
1. Use stock         → install + accept defaults
2. Configure         → enrichments in client.json      ← here
3. Customize behavior → clone + edit source
4. Author new        → write a generator from scratch
```

Enrichments are level 2. They let you tweak per-operation behavior without
bringing source into your project. The price: you can only tweak what the
generator's author chose to expose.

If the generator doesn't expose what you need:

- **Stop and consider**: maybe the answer is to clone (level 3) and add the
  enrichment field yourself.
- **Or**: clone and just hardcode the desired behavior — no enrichment needed if
  it's project-specific anyway.

Adding enrichments to a stock generator (to expose what users have been
hardcoding) is a reasonable upstream contribution. Adding enrichments to a
clone-then-published fork is fine for project- local needs.

## Validation and warnings

Three loud layers validate enrichments: a structurally invalid block
fails at CLI load, a wrongly-typed value in a reached leaf fails that
item's generation (the run completes; the manifest records the error
with the path), and a declared variant block missing `main` throws.

What those layers cannot see is *addressing* — a typo'd generator id,
path, method, or model name makes the lookup miss silently, and an
unknown leaf key is stripped before the generator sees it. The engine
audits both after every run and reports on
`manifest.enrichmentWarnings` (also printed as an "Enrichment
warnings" block in CLI output):

| Type | Level | Meaning |
|---|---|---|
| `UNCONSUMED_ENRICHMENT` | warning | A configured routing path no lookup consumed — typo'd path/method/model name, or an entry orphaned by spec evolution |
| `UNKNOWN_GENERATOR_ID` | warning | A top-level key matching no generator in the run |
| `UNKNOWN_ENRICHMENT_KEY` | warning | A leaf key the generator's schema does not declare (with a nearest-key suggestion: `submitLabl` → did you mean `submitLabel`?) |
| `SKIPPED_SUBJECT_ENRICHMENT` | info | Addressed correctly, but the subject is excluded by `skip`/`include` |
| `SKIPPED_GENERATOR_ENRICHMENT` | info | The whole generator is skipped while enrichments for it exist |

Warnings never affect output — generation stays fail-open. If a
customization silently doesn't land, this is the first place to look:
`jq '.manifest.enrichmentWarnings' out.json`. Full shape:
[manifest format](../reference/manifest-format.md#enrichmentwarnings).

## Common patterns

### Per-operation titles and labels

The most common enrichment pattern. The form generator's `title` and
`submitLabel` enable per-form text without cloning:

```json
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "/users": {
        "post": { "title": "Create User", "submitLabel": "Create" }
      },
      "/users/{id}": {
        "put": { "title": "Edit User", "submitLabel": "Save" },
        "delete": { "title": "Delete User", "submitLabel": "Delete" }
      }
    }
  }
}
```

### Field-level overrides

When a schema field needs special handling that the generator's default routing
doesn't cover:

```json
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "/contacts": {
        "post": {
          "fields": [
            {
              "id": "officeIds",
              "references": "GetOffices",
              "referenceKind": "searchable"
            }
          ]
        }
      }
    }
  }
}
```

This tells the form generator: when rendering the `officeIds` field of
`POST /contacts`, route it to the `GetOffices` operation (searchable dropdown),
not the default string-array renderer.

### Operation-reference patterns

A common enrichment shape across generators: pointing one operation at another.
The `references` field in form fields above is an example — the form's
`officeIds` field references the `GetOffices` operation as the source of
selectable values.

This is how generators compose across the operation graph without hardcoded
knowledge of specific operations.

## Common questions

### Are enrichments validated?

Yes, at three levels. A structurally invalid `enrichments` block fails
at CLI load (`ConfigValidationError`). A wrongly-typed value in a leaf
the routing reaches fails that item's generation — the run completes,
the manifest records the error, and the message names the path. And
since `@skmtc/core@0.28.0`, the addressing layer warns too: see
"Validation and warnings" above.

### Can I extend a stock generator's enrichments without cloning?

No. The enrichment schema is part of the generator's source. To add new keys,
you clone the generator and edit `enrichments.ts`.

### Are enrichments hot-reloadable?

Yes — they're runtime config, not bundle code. Edit `client.json`, re-run
`skmtc generate`, the new values apply. No rebundle needed. This is part of why
enrichments are the right lever for narrow per-operation tweaks.

### What about per-model enrichments (vs per-operation)?

Model generators (like `gen-zod` or `gen-typescript`) route the subject scope by
`refName` (then `variant`):

```json
{
  "enrichments": {
    "@skmtc/gen-zod": {
      "UserModel": { "main": { "description": "A user account" } }
    }
  }
}
```

`refName` → `variant` locates the subject leaf; the value beneath the variant
**is** the validated subject payload. (`variant` defaults to `'main'`.)

### Can I share enrichment values across generators?

Yes — that's exactly what the **stack** scope is for. The reserved top-level
`_stack` key holds one leaf every generator in the composition can read (via
`toStackEnrichment(context, schema)`). Each consuming generator passes a
_partial_ schema describing only the fields it reads — Valibot ignores unknown
keys, so fields other generators consume don't interfere.

What you _can't_ share is a **subject** or **generator** scope leaf — each
generator declares its own shape independently there. If you want the same
per-item value across generators without using `_stack`, you replicate the
relevant portion to each generator's section.

### Do enrichments survive when I clone the generator?

User data in `client.json` is unaffected by cloning. But if the clone keeps the
same routing shape (same projection-base factory) **and** the same generator
`id`, the existing enrichments still land. If you change the `id` (which you
typically do when you republish), update the `client.json` keys to match the new
id.

## Declaring and consuming enrichments (authors)

Declaring the Valibot schema, reading the parsed umbrella off
`this.settings.enrichments`, the extensions-vs-enrichments decision,
and the AI-driven `EnrichmentRequest` surface all live in the
authoring guide:
[add enrichment options](../authoring/how-to/add-enrichment-options.md).

## Further reading

- [Clone vs install](clone-vs-install.md) — where enrichments fit on the
  customization gradient
- [Projects and workspaces](projects-and-workspaces.md) — where `client.json`
  lives
- [Settings reference: client.json schema](../reference/settings/client-json-schema.md)
- [Settings reference: enrichments shape](../reference/settings/enrichments-shape.md)
- [How to configure enrichments](../using/how-to/configure-enrichments.md) — the task-level guide
  for configuring enrichments
- [Add enrichment options](../authoring/how-to/add-enrichment-options.md) — how to declare
  a new enrichment in your generator
