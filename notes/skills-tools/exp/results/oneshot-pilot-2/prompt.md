# Task: author `@exp/gen-api-client` — a tag-grouped API client generator

You are working in a standalone workspace. Author an SKMTC generator
package at `./gen-api-client` that generates a typed fetch client from
the OpenAPI document in `fixture/openapi.json`.

SKMTC is a code-generation engine: a generator package plugs into its
pipeline and is invoked per subject of the schema. `@skmtc/core`,
`@skmtc/lang-typescript`, and the stock model generator `@skmtc/gen-zod`
are wired in this workspace's `deno.json`.

## Contract

- `./gen-api-client/mod.ts` default-exports the generator entry; the
  package is named `@exp/gen-api-client` in `./gen-api-client/deno.json`.
- **One class per tag**: every operation tagged `orders` becomes a method
  on a single `OrdersClient` class in `@/client/OrdersClient.generated.ts`;
  same pattern for `addresses` (`AddressesClient`). A tag's class and
  file must be created once, no matter how many operations share the tag.
- **One method per operation**, named from the method + path (e.g.
  `GET /orders/{id}` → `getOrdersId` or similar deterministic scheme —
  do not use operationId). Path parameters become method parameters; the
  path is templated into the `fetch` call; POST bodies are passed and
  JSON-stringified.
- **Responses are validated with zod schemas produced by
  `@skmtc/gen-zod`**: each method returns
  `<zodSchema>.parse(await res.json())` where `<zodSchema>` is the
  schema constant for the operation's response model, produced through
  gen-zod's projection via the engine (the schema definitions must land
  in their own files and be imported into the client files — do NOT
  write zod schema text by hand and do NOT hand-write those imports).
  A model used by several operations must be defined exactly once.

## Verify

Run `deno task verify` — it runs the engine over the fixture with your
generator, writes artifacts to `out/`, and typechecks them. Success:
verify exits 0; `out/client/OrdersClient.generated.ts` (3 methods) and
`out/client/AddressesClient.generated.ts` (1 method) exist; the zod
model files exist under `out/`; everything compiles.

Do not edit `harness.ts`, `fixture/`, `deno.json`, or `check.deno.json`.
Work only inside this directory (the generator lives in
`./gen-api-client`). When done, print DONE plus a one-paragraph summary.

## ONE-SHOT MODE (important)

Do NOT use any tools. Reply with the COMPLETE generator package as file
blocks and nothing else — every file the package needs, each in this
exact fence format:

===FILE: gen-api-client/deno.json===
<file content>
===END===

All reference material you need is below; do not ask questions.

## Reference: skill skmtc-generator-v3
---
name: skmtc-generator-v3
version: 0.2.1
description: >
  Author and edit SKMTC generators — packages that project an OpenAPI
  domain model into application code. Method: clone the nearest stock
  generator, then apply the engine rules imitation can't teach. Assumes
  zero prior SKMTC knowledge. Use when asked to "write a skmtc
  generator", "author/clone/customize gen-x", "add a field type",
  "change export paths", "add enrichment options", or when editing
  generator source. ALWAYS pair with the target language's skill
  (skmtc-lang-typescript-v3, skmtc-lang-kotlin-v3).
---

# Authoring SKMTC generators

## 1. What SKMTC is

SKMTC derives application code from an OpenAPI document treated as a
domain model. A **stack** of **generators** (small, opinionated,
cloneable packages) is run by a deterministic engine that sweeps every
subject of the schema — each **model** (component schema, by `refName`)
and each **operation** (`path` + `method`) — through each generator.
Outputs are regenerated wholesale every run: never hand-edit generated
files; customize the generator. Generators compose: a React-Query
generator reuses the Zod generator's schemas through the engine's cache.

## 2. The method: start from a stock generator

The fastest reliable route to a correct generator is imitation of a
published one — clone the structure, swap the target syntax. Pick the
nearest exemplar:

| Need | Clone |
|---|---|
| model → validator/schema value | `@skmtc/gen-zod` (also gen-arktype, gen-valibot) |
| model → type declaration | `@skmtc/gen-typescript` |
| operation → client hook, consuming a model generator | `@skmtc/gen-tanstack-query-fetch-zod` |
| many subjects → one shared file (accumulator) | `@skmtc/gen-msw`, `@skmtc/gen-express` |
| Kotlin | structure from `gen-kotlin-*`, but their lang-API call shapes are STALE — take call shapes from skmtc-lang-kotlin-v3 only |

Fetch source from JSR: `https://jsr.io/@skmtc/<name>/meta.json` → pick
version → fetch files (or `deno doc jsr:@skmtc/<name>`). Keep the
package convention exactly as cloned:

```
gen-x/  deno.json (name @scope/gen-*, EXACT-version @skmtc/* pins,
        lint plugin jsr:@skmtc/lint-plugin)
        mod.ts            → re-exports + `export { entry as default }`
        src/mod.ts        → the entry: toModelEntry / toOasOperationEntry
        src/base.ts       → identity statics via the lang base factory
        src/enrichments.ts→ enrichment schema (emptyEnrichmentSchema opt-out)
        src/XProjection.ts→ constructor builds the value tree
        src/<router>.ts   → schema-type → snippet dispatch
```

What you adapt: the identity policy in `base.ts` (names, export paths,
identifier kind) and the router's per-type snippets (your target
syntax). What you keep: everything else — the shape is the point.

## 3. The one law: your code never writes output text

Three phases: parse → **generate** (your code runs here) → render
(`toString()` runs once per file, only here). During generate the output
does not exist; your generator builds **object trees** the engine can
walk, attribute, deduplicate, and settle imports from.

**The trap**: template strings full of target syntax
(`` `export const ${name} = ...` ``) compile, render — and silently break
imports (never settled into the header), reuse (text is invisible to the
cache → duplicates), composition (peers can't reference text), and
provenance. Lint rules `skmtc/no-template-imports` and
`skmtc/no-adhoc-tostring` catch the worst mechanically; keep them wired.

**Litmus, applied at the keystroke**: target-language punctuation inside
a string that will be STORED on an object → stop, build the object.
Strings are legitimate as *leaves*: identifier names, export paths,
module specifiers, literals, a cached peer *name*, and final syntax
assembled **inside a `toString()` body** from already-structured fields.
Prefer composing even render-time syntax inside `toString()` over helper
functions that return strings — helpers drift.

## 4. What imitation can't teach: the engine rules

- **Identity before construction.** `toIdentifierName` / `toIdentifierType`
  / `toExportPath` are statics computed from `(subject, enrichments,
  variant)` WITHOUT constructing the projection. This is the invariant
  everything rests on: cheap cache probes, and peers knowing where your
  artifact *will* live. Never make a name depend on construction.
- **Coordination is memoization.** The cache is the file map, keyed
  `(identifier.name, exportPath)`. On a peer reference the Driver probes
  `findDefinition`; hit → reuse (constructor never runs) + auto-stitched
  import; miss → construct recursively. So: never hardcode a peer's name
  or path — insert and read the result, minding the two return shapes:
  `insertModel(Peer, refName)` returns an **Inserted handle** (name via
  `.toName()`, definition via `.definition`), while
  `insertNormalizedModel(Peer, { schema, fallbackName })` returns the
  **definition itself** (name via `.identifier.name`). Never hand-write
  peer imports; never import a peer's naming helpers (ask
  `context.toModelContentSettings` if you need identity without
  materializing). Key collision under different generators throws
  `Registered definition mismatch`.
- **Two composition shapes.** Projection (one definition per subject —
  entry calls `insertModel`/`insertOperation`) and accumulator (many
  subjects append into one definition — entry does
  `context.findDefinition(...) ?? defineAndRegister(context, {...})`
  then mutates the container value; the sanctioned exception to "no
  methods beyond constructor and toString"). `defineAndRegister` is a
  **lang-package free function** (import it from your lang package) —
  there is no `context.defineAndRegister`; that API was deleted.
- **When in doubt, make it a producer.** The cost asymmetry is one-way:
  a producer that never needed to be one costs a few lines; a string
  that later needed to be a producer severs the chain for everything
  built on it. Assume your value will be built upon.
- **Thread the variant.** `transform({ context, operation, variant })` →
  pass `variant` through to `insertOperation`, and fold it into names
  with `withVariant`. Dropping it collides every variant onto `'main'`.
- **Enrichments are the only config channel** (bundled generators take
  no options; module state breaks determinism). Declare a valibot
  three-scope umbrella (`subject`/`generator`/`stack`); the opt-out is
  `export const toEnrichmentSchema = () => emptyEnrichmentSchema` — a
  FUNCTION returning the schema, required in both the entry config and
  the base-factory config. Read via
  `this.settings.enrichments.subject?...`; unread keys surface as
  warnings.
- **Naming**: models from `refName` casing (core's `camelCase`,
  `capitalize`, `decapitalize`); operations from **method + path** via
  core's `toEndpointName` (post→Create, put→Update). **Never**
  `operationId` — spec-author-controlled; no stock generator reads it.
- **Registration at construction; `toString()` is a prototype method**
  reading precomputed fields (an arrow-function `toString` field breaks
  provenance wrapping). Errors are isolated per subject — a throw kills
  one artifact, not the run.

## 5. Verify against the run

**Never guess a signature.** SKMTC has almost no training-data presence;
your recalled API shapes are unreliable. Exact signatures for core
contracts (`Oas*` classes, `Inserted`, `ContentSettings`,
`TypeSystemArgs`, entry configs) are one command away:
`deno doc jsr:@skmtc/core@<pinned-version> <SymbolName>` — read it
instead of guessing, and instead of casting around a type error.

Generation is sub-second — run it after every meaningful change. Read in
order: (1) manifest — expected definitions at expected paths? parse
issues? per-item errors? (2) one golden artifact — **import header
first** (missing import = a string swallowed a snippet), then the body;
(3) `deno lint`; (4) if you consume a peer: their definition exists once
and your file imports it. Never "fix" missing output by concatenating
the text into a template.

## 6. Pitfalls

| Symptom | Fix |
|---|---|
| Import missing / appears mid-file | Declare via `register`, never in templates |
| Duplicate definitions of a shared model | Reference peers via `insertModel`, not by name |
| `Registered definition mismatch` | Thread `variant`; or two generators claim one (name, path) |
| Peer output name wrong | Read `.identifier.name` off the insert result |
| Works once, breaks on recursion/refs | Build tree in constructor; refs via the ref snippet/Driver |
| Enrichment ignored | Umbrella routing key mismatch — check warnings |
| Output edits vanish | You edited generated files; customize the generator |
| Router misroutes custom values | `schema.type === 'custom'` is a real dispatch case — presence-test with `'readOnly' in schema`-style guards, not type equality |
| `null` slips through an optional guard | `!== undefined` lets `null` pass on Nullable generics — check both |
| `insertResult.identifier` is a type error | You have an `Inserted` handle (from `insertModel`) — use `.toName()`/`.definition`; only `insertNormalizedModel` returns the definition |

## 7. The lang layer

Everything concrete — base-factory names, snippet classes,
File/Import/Definition, identifier factories, emitted-language import
rules, sanitization — lives in the target language's package and skill.
Load `skmtc-lang-typescript-v3` or `skmtc-lang-kotlin-v3` before writing
code. Lang skill wins on language specifics; this skill wins on engine
semantics.

Scope note: this skill covers **OpenAPI input**. GraphQL SDL input
exists (`toGqlOperationEntry`, subject routing by
`[rootKind][fieldName]`) — for GraphQL authoring load the
`skmtc-graphql` skill alongside; the engine rules here apply unchanged.

## Reference: skill skmtc-lang-typescript-v3
---
name: skmtc-lang-typescript-v3
version: 0.2.1
description: >
  The TypeScript target-language layer for SKMTC generators
  (@skmtc/lang-typescript): projection base factories, TsSnippet, the
  three register shapes, identifier kinds and the type-only import
  machinery, composition helpers, sanitization, TsFile render rules.
  Use ALONGSIDE skmtc-generator-v3 whenever a generator emits
  TypeScript. Headings are the template for other skmtc-lang-*-v3
  skills.
---

# The TypeScript layer (@skmtc/lang-typescript)

Read `skmtc-generator-v3` first; you will normally have cloned
`@skmtc/gen-zod` (model) or `@skmtc/gen-tanstack-query-fetch-zod`
(operation) — **those are the worked examples**. This skill carries the
rules that aren't visible from imitation alone.

## 1. Declaring the language

The declaration is the import graph — no `lang` config field exists.
`src/base.ts` imports a factory; the returned class extends `TsSnippet`,
which carries the `static lang` Drivers read pre-construction.

```ts
import { toTsModelProjectionBase } from '@skmtc/lang-typescript'

export const MyBase = toTsModelProjectionBase<EnrichmentSchema>({
  id: denoJson.name,
  toIdentifierName({ refName }) { return decapitalize(camelCase(refName)) },
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath({ refName, enrichments, variant }) {
    const name = this.toIdentifierName({ refName, enrichments, variant })
    return join('@', 'types', `${name}.generated.ts`)   // '@/' root marker
  },
  toEnrichmentSchema
})
```

Factories: `toTsModelProjectionBase`, `toTsOasOperationProjectionBase`
(+ webhook/GQL variants). Snippets extend `TsSnippet` directly. Casing
helpers (`camelCase`, `capitalize`, `decapitalize`) and `toEndpointName`
come from `@skmtc/core`; `join` from `@std/path`.

A projection consumable by peers via `insertNormalizedModel` also needs
two statics: `schemaToValueFn` (your router) and `createIdentifier`.

## 2. The three register shapes

| Caller | Call | Destination |
|---|---|---|
| Projection | `this.register(args)` | its own export file |
| Projection | `this.registerInto(path, args)` | explicit file |
| Snippet | `this.register({ ...args, destinationPath })` | required — snippets own no file |

Free functions for transform-level code: `register(context, args)`;
`defineAndRegister(context, { identifier, value, destinationPath })` —
no cache check (pair with `context.findDefinition` for the accumulator
get-or-create idiom). Args:
`{ imports?: Record<module, ImportNameArg[]>, reExports?, definitions?,
custom? }`. `register` creates the file on first write and drops
self-imports, so register imports unconditionally — per-leaf
registration (every snippet needing `z` registers `{ zod: ['z'] }`) is
the correct pattern, and merging is idempotent.

## 3. Identifier kinds

`TsEntityType = 'variable' | 'type' | 'class' | 'interface' |
'namespace'` — factories `createVariable(name, { typeName? })`,
`createType`, `createClass`, `createInterface`, `createNamespace`.
No `'function'` kind: a generated function is a `variable` whose value
renders as an arrow function.

`toIdentifierType` is one lever with three effects: declaration keyword;
block form (class/interface/namespace take no `= value;`); and whether
consumers import it **type-only** (`type` and `interface` do — this is
what keeps consumers compiling under `verbatimModuleSyntax`/TS1484, and
you get it by choosing the kind, never by writing import syntax).
File dedup keys on keyword+name, so `class Foo` + `namespace Foo`
coexist (declaration merging); first write wins per slot.

## 4. Emitted-import rules

Concise forms per module: `['z']` (named), `[{ default: 'invariant' }]`
(aliased/default), `[{ name: 'User', type: 'type' }]` (type-only).
Sharp edge: only `type: 'type'` triggers type-only in the concise form —
`type: 'interface'` does NOT; tag interfaces `type: 'type'`. Register
against `@/…` export paths; module names are re-keyed at render via the
project's package settings.

## 5. Composition helpers

All `Stringable`, all deferring joins to render — use them instead of
`array.join` whenever items are snippets (joining pre-renders and orphans
provenance):

- `List` — `List.toObject/toArray/toParams/toLines/toKeyValue`,
  `List.fromKeys(record).toObject(fn)`, `new List(values, { separator,
  bookends, skipEmpty })`.
- `FunctionParameter({ typeDefinition, destructure, required, skipEmpty })`
  — one object, four readings: `toString()` (declaration), `toInbound()`
  (call site), `toPropertyList()`, `hasProperty(name)`.
- `toPathTemplate('/users/{id}')` → `` /users/${id} ``; `toPathParams` →
  `/users/:id`; `PathParams` bundles type + parameter + template.
- `keyValues`, `withDescription`, `handleKey`, `handlePropertyName`;
  `TsClass`/`TsHeritage` for class syntax (`TsHeritage` registers its own
  heritage imports).

## 6. Sanitizing emitted names

Two different questions: `sanitizeIdentifier(name)` for **binding
names** (`export const <name>`; repairs `'2fa'` → `'_2fa'`, reserved →
suffixed) vs `sanitizePropertyName(name)` for **property keys /
destructuring** (returns a rename pair when repair is needed). Never
hand-roll keyword lists.

## 7. Files

Render order: custom banner → re-exports → imports → definitions;
first-wins per definition slot makes output order-independent. You
almost never construct `TsFile`/`TsImport`/`TsDefinition` yourself —
`register` and the Drivers do.

## 8. The contrast that matters

```ts
// WRONG: stored rendered text — z import never registers, refs duplicate
this.properties[key] = `z.string().optional()`
// RIGHT: stored snippet — imports settle, cache sees it, provenance holds
this.properties[key] = toMyValue({ schema: propSchema, required, destinationPath, context })
```

A cached peer *name* is a legitimate string — minding the two insert
return shapes: `this.responseName = definition.identifier.name` from
`insertNormalizedModel`, or `.toName()` off `insertModel`'s `Inserted`
handle. Modifier pipelines (`applyModifiers`-style) run inside
`toString()`, never to build stored fields.

## 9. TypeScript pitfalls

| Symptom | Fix |
|---|---|
| TS1484 in consumers | Identifier kind `type`/`interface`; concise imports need `type: 'type'` |
| Interface import emitted as value | Tag it `type: 'type'` (known concise-form gap) |
| TS7022/7024 on recursive schemas | Set `settings.identifier.typeName` (e.g. `z.ZodType<X>`) post-construction; the *name* stays stable |
| Provenance holes under some nodes | `toString` must be a prototype method, never an arrow field |
| Doubled `?`/modifiers | One owner: apply modifiers once, at the leaf's render |

## Partial exemplar: @skmtc/gen-express (accumulator entry — note: uses context.insertOperation for the container; findDefinition ?? defineAndRegister is the other accumulator form)
```ts
import invariant from 'npm:tiny-invariant@^1.3.3'
import { ExpressApp } from './ExpressApp.ts'
import { toOasOperationEntry } from 'jsr:@skmtc/core@0.28.3'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const expressEntry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform: ({ context, operation, variant }) => {
    const enrichments = ExpressApp.toEnrichments({ operation, context, variant })
    const app =
      context.findDefinition({
        name: 'app',
        exportPath: ExpressApp.toExportPath({ operation, enrichments, variant })
      }) ?? context.insertOperation({ projection: ExpressApp, operation, variant }).definition

    invariant(app?.value instanceof ExpressApp, 'app must be an instance of ExpressApp')

    app.value.append(operation)
  }
})

import { List, type ListArray, type ListLines } from 'jsr:@skmtc/lang-typescript@0.12.17'
import type { OasOperationProjectionConstructorArgs, OasOperation } from 'jsr:@skmtc/core@0.28.3'
import { ExpressAppBase } from './base.ts'
import { ExpressRoute } from './ExpressRoute.ts'
import type { EnrichmentSchema } from './enrichments.ts'

export class ExpressApp extends ExpressAppBase {
  methods: ListArray<string>
  routes: ListLines<ExpressRoute>

  constructor({ context, operation, settings }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    this.methods = List.toArray([])
    this.routes = List.toLines([])

    // Register imports needed across all routes
    this.register({
      imports: {
        express: ['Router', 'Request', 'Response', 'NextFunction']
      }
    })
  }

  append(operation: OasOperation) {
    const method = `'${operation.method.toUpperCase()}'`

    if (!this.methods.values.includes(method)) {
      this.methods.values.push(method)
    }

    this.routes.values.push(
      new ExpressRoute({
        context: this.context,
        operation,
        destinationPath: this.settings.exportPath
      })
    )
  }

  override toString(): string {
    return `Router()

${this.routes}
`
  }
}
```

## Partial exemplar: @skmtc/gen-tanstack-query-fetch-zod QueryFn (consuming gen-zod via insertNormalizedModel)
```ts
import { List, toPathTemplate, FunctionParameter, type ListObject } from 'jsr:@skmtc/lang-typescript@0.12.17'
import { capitalize, decapitalize, OasVoid } from 'jsr:@skmtc/core@0.28.3'
import type { OasOperationProjectionConstructorArgs } from 'jsr:@skmtc/core@0.28.3'
import { TanstackQueryBase } from './base.ts'
import type { EnrichmentSchema } from './enrichments.ts'
import { TsProjection } from 'jsr:@skmtc/gen-typescript@0.2.5'
import { ZodProjection } from 'jsr:@skmtc/gen-zod@0.2.5'

export class QueryFn extends TanstackQueryBase {
  zodResponseName: string
  parameter: FunctionParameter
  queryParamArgs: ListObject<string>
  constructor({ context, operation, settings }: OasOperationProjectionConstructorArgs<EnrichmentSchema>) {
    super({ context, operation, settings })

    this.queryParamArgs = List.toObject(operation.toParams(['query']).map(({ name }) => name))

    const typeDefinition = this.insertNormalizedModel(TsProjection, {
      schema: operation.toParametersObject(),
      fallbackName: `${capitalize(settings.identifier.name)}Args`
    })

    this.parameter = new FunctionParameter({
      typeDefinition,
      destructure: true,
      required: true,
      skipEmpty: true
    })

    const zodResponse = this.insertNormalizedModel(ZodProjection, {
      schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
      fallbackName: `${decapitalize(settings.identifier.name)}Response`
    })

    this.zodResponseName = zodResponse.identifier.name
  }

  override toString(): string {
    const { path, method } = this.operation

    return `async () => {
      const res = await fetch(\`${toPathTemplate(path)}\`, {
        method: '${method.toUpperCase()}'
      })

      if (!res.ok) {
        const error = await res.text()
        throw new Error(error)
      }
    
      const data = await res.json()

      return ${this.zodResponseName}.parse(data)
    }`
  }
}
```

## The input schema (fixture/openapi.json)
```json
{
  "openapi": "3.0.3",
  "info": { "title": "Orders API (exemplar-poor experiment fixture)", "version": "1.0.0" },
  "paths": {
    "/orders": {
      "get": {
        "tags": ["orders"],
        "summary": "List orders",
        "responses": {
          "200": {
            "description": "All orders",
            "content": {
              "application/json": {
                "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Order" } }
              }
            }
          }
        }
      },
      "post": {
        "tags": ["orders"],
        "summary": "Create an order",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/Order" }
            }
          }
        },
        "responses": {
          "201": {
            "description": "The created order",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Order" }
              }
            }
          }
        }
      }
    },
    "/orders/{id}": {
      "get": {
        "tags": ["orders"],
        "summary": "Get one order",
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": {
            "description": "The order",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Order" }
              }
            }
          }
        }
      }
    },
    "/addresses/{id}": {
      "get": {
        "tags": ["addresses"],
        "summary": "Get one address",
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": {
          "200": {
            "description": "The address",
            "content": {
              "application/json": {
                "schema": { "$ref": "#/components/schemas/Address" }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Order": {
        "type": "object",
        "required": ["id", "status", "items", "shippingAddress"],
        "properties": {
          "id": { "type": "string" },
          "status": { "$ref": "#/components/schemas/OrderStatus" },
          "items": {
            "type": "array",
            "items": { "$ref": "#/components/schemas/OrderItem" }
          },
          "shippingAddress": { "$ref": "#/components/schemas/Address" },
          "billingAddress": { "$ref": "#/components/schemas/Address" },
          "notes": { "type": "string", "nullable": true }
        }
      },
      "OrderItem": {
        "type": "object",
        "required": ["sku", "quantity", "unitPrice"],
        "properties": {
          "sku": { "type": "string" },
          "quantity": { "type": "integer" },
          "unitPrice": { "type": "number" },
          "giftWrap": { "type": "boolean" }
        }
      },
      "OrderStatus": {
        "type": "string",
        "enum": ["pending", "paid", "shipped", "cancelled"]
      },
      "Address": {
        "type": "object",
        "required": ["line1", "city", "postalCode", "country"],
        "properties": {
          "line1": { "type": "string" },
          "line2": { "type": "string" },
          "city": { "type": "string" },
          "postalCode": { "type": "string" },
          "country": { "type": "string" }
        }
      }
    }
  }
}
```
