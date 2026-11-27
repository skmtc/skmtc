# Operation generators: split the operation, refer to the models

An **operation generator** turns each operation (`path` + `method`)
into one definition in one file. The output differs by family: a hook, a
client function, a form and a docs page look nothing alike. What they
share is the way they are built: producers for the parts of the output,
the operation read through its own methods, and each schema taken from
a model generator by an insert.

## 1. The method

There is no skeleton for this shape. Clone the stock generator whose
output is nearest:

| Output | Clone |
|---|---|
| A function for each operation: a client call, a handler | `@skmtc/gen-effect-http`. `producers.md` walks through its ten classes |
| A hook over a model generator | `@skmtc/gen-tanstack-query-fetch-zod` |
| A form or other UI for each operation, with variants | `@skmtc/gen-shadcn-form` |
| Many operations in one file | An accumulator: `@skmtc/gen-msw`, `@skmtc/gen-express` (`engine.md`, "Two shapes of generator") |

Then follow the steps in `SKILL.md`: write the output for two
operations by hand, name its parts, and make one producer for each. The
clone shows the package layout: entry, base, projection, snippets. This
page has the rules that the clone does not show.

## 2. The subject API — read, never re-parse

Every piece of the operation comes from the engine's `OasOperation`,
by name. Re-spelling any of them (parsing the path yourself, guessing
a response shape) breaks the moment the schema evolves.

- **Name**: derive from **method + path** via core's
  `toEndpointName(operation)` (post→Create, put→Update...), then apply
  your policy (`use` prefix, `Fn` suffix). **Never `operationId`** —
  author-controlled, absent in many specs, unstable across emitters.
- **Filter**: `isSupported({ operation })` in the entry config — claim
  only what you can render (e.g. mutations require
  `operation.toRequestBody(({ schema }) => schema)` to exist). An
  unfiltered entry constructs subjects it can't handle, and each one
  that throws fails the run. OpenAPI 3.2 documents add the `query` method:
  `toEndpointType` counts it as a query, like `get`, and a `switch`
  over `operation.method` needs a `query` arm. Filter it out when your
  target has no way to send it.
- **Inputs**: `operation.toParams(['path'])` / `['query']` /
  `['header']` / `['cookie']` for individual parameters;
  `operation.toParametersObject()` for all of them as ONE object
  schema — the form you hand to a model generator (§3). A 3.2
  `querystring` parameter is the whole query string as one schema,
  taken from its single `content` entry. `['query']` does not include
  it; ask for `['querystring']`. Both include the path item's
  `parameters`; an operation's own parameter with the same name and
  location replaces the path item's. `operation.toEffectiveParameters()`
  is the same merged list with refs unresolved: use it to resolve each
  parameter by itself, for example to render a `$ref` that names nothing
  when `danglingRefs` lists `parameter`. Do not read
  `operation.parameters` for this: it holds the operation's own
  parameters only. A parameter with neither `schema` nor `content`
  reads as the empty schema `{}` (unknown), with a
  `MISSING_PARAMETER_SCHEMA` warning.
- **Request body**: `operation.toRequestBody(({ schema }) => schema)`.
- **Response**: `operation.toSuccessResponse()?.resolve().toSchema()
  ?? OasVoid.empty()` — selection and void-fallback in one idiom.
- **Media type**: with no argument, both lookups read the JSON media
  type: `application/json`, else the first `application/…+json` or
  `application/json;…` key, else `*/*` when its schema is an object,
  array, union, intersection or `$ref` (the parser logs a
  `WILDCARD_MEDIA_TYPE` warning for that body). A body with only `text/plain`, `application/*` or a
  scalar under `*/*` gives `undefined`; to read it, pass the media type,
  for example `toSchema('text/plain')`. `toJsonContent()` names the key it
  chose (`mediaType`) and the type to send it as (`contentType`:
  `application/json` for `*/*`); `toRequestBody`'s map gets both.
- **Request line**: `operation.path` and `operation.method` are stored
  facts; the target-syntax path template (`/users/${id}` vs
  `"/users/{id}"`) is RENDER-time work done by your lang layer's
  path-template helper inside a `toString()` body.
- **Grouping**: `operation.tags`.

## 3. The operation law: schemas in your output are peer references

An operation's params object, request body, and response are schemas —
and rendering a schema is a MODEL generator's job. The single worst
operation-generator failure is rendering one inline: it compiles, then
duplicates the model, drifts from the canonical definition, and its
imports never settle.

An inline schema (one with no name) goes through
`insertNormalizedModel`, with a fallback name derived from **your own
settings identifier**, so variants stay apart:

```ts
const args = this.insertNormalizedModel(PeerProjection, {
  schema: operation.toParametersObject(),
  fallbackName: `${capitalize(settings.identifier.name)}Args`
})

const response = this.insertNormalizedModel(PeerProjection, {
  schema: operation.toSuccessResponse()?.resolve().toSchema() ?? OasVoid.empty(),
  fallbackName: `${decapitalize(settings.identifier.name)}Response`
})
this.responseName = response.identifier.name   // the NAME is yours; the definition is theirs
```

A snippet inserts through `context`, with the path of the file it
renders into:
`context.insertNormalizedModel(PeerProjection, { schema, fallbackName, destinationPath })`.
Put each insert in the producer that uses its result, so that the
projection's constructor stays small (`producers.md`, rule 7).

Named `$ref` schemas go through `insertModel(Peer, ref)` with the
`OasRef` itself (name via `.toName()`): its `refPath` tells a ref into a
`$defs` entry, a property or `#/paths/…` apart from the component of the
same name. `insertNormalizedModel` passes a `$ref` schema on the same
way. Either way: the
peer renders the schema ONCE at its own
path, your file's import is stitched by the engine, and only the
identifier lands in your tree. Import peer projections through their
package alias (`@skmtc/gen-zod`), never by relative path.

When the peer declares caller options, the trailing argument is
required and typed by the peer:
`this.insertModel(Peer, ref, { options: { suffix: 'Input' } })` —
a fresh object per insertion; a peer that declares none refuses the
key. On `insertNormalizedModel` the options reach the `$ref` branch
only: the inline branch constructs no projection, so put whatever
distinguishes the call into `fallbackName`.

What the insert gives you is the convention: the name, the file (a
normalized model goes into YOUR export path) and the form of the
declaration. When it is not what you want, follow `engine.md`, "Another
generator's output". Do not call the peer's statics, build a `ref` from
a string, or read fields of the peer's value other than its definition
and its name.

## 4. Kinds of operation

A model generator chooses by schema type, in its router. An operation
generator chooses by the kind of operation: the method, a body or none,
a response or none. The producer that holds the part chooses, in its
constructor (`producers.md`, rule 4):

```ts
this.response = responseSchema === undefined
  ? new ResponseVoid({ context })
  : new ResponseRead({ context, destinationPath, schemaName: response.name })
```

Each kind is a snippet class of its own. Its constructor stores
producers and the names of peers, and its `toString()` writes the
target code. A library import (`useQuery`, a client class) registers in
the constructor of the producer that renders it.

When you are about to write the code for a schema by hand (a list of
fields, a validator call, the body of a type), insert it into a model
generator.

## 5. Variants

`transform({ context, operation, variant })` — pass `variant` through:
`context.insertOperation({ projection, operation, variant })`.
Dropping it constructs every variant as `'main'` and dies on the
second with `Registered definition mismatch`. Names fold the variant
via `withVariant` in the base; anything you derive from
`settings.identifier.name` (the fallback names of section 3 too)
inherits it. That is one reason to derive those names and not write
them by hand.

## 6. Enrichments

Same three-scope umbrella as models; the subject key for operations is
`[path][method]` (plus variant where variants exist). Opt-out stays
`toEnrichmentSchema = () => emptyEnrichmentSchema`.

## 7. Verify

Generation is sub-second — run after every change. Operation-specific
reading order: (1) your artifact's **import header** — every consumed
model must appear as an import of the peer's file (missing = a string
swallowed a schema); (2) the peer's files — each consumed schema
defined exactly ONCE, named as expected (an `Args`/`Response`
explosion or a `...2` suffix means fallback names collided or weren't
identifier-derived); (3) unsupported operations absent, not errored.

## 8. Operation pitfalls

| Symptom | Fix |
|---|---|
| Names change when the spec author edits `operationId` | Derive from method+path via `toEndpointName` |
| Response/body/params rendered inline in your file | Section 3: insert into a model generator; only the name is in your tree |
| Peer model duplicated per operation | `fallbackName` not derived from `settings.identifier.name`, or peer referenced by hand-written name |
| `Registered definition mismatch` on the second variant | Thread `variant` into `insertOperation` |
| `Registered definition mismatch` naming `Cached options` | The peer's name ignores options its output depends on — fix the peer's `toIdentifierName`, not your call |
| Run fails on operations you never meant to handle | Missing/loose `isSupported` |
| Path renders with wrong interpolation | Path template belongs to the lang layer, at render — never build it into a stored string |
| Peer import points into another package's source tree | Import via the `@skmtc/*` package alias |
| A helper builds a `#/components/schemas/...` string, or calls a peer's identity statics | A second copy of the insert. Use the peer's two doors (`engine.md`, "Another generator's output") |
| Peer's rendered value looks wrong in declaration position | The type and the declaration differ in that language. See `model.md`, section 6, and do not read the peer's fields |
| One constructor does every insert and builds every part | Give each part a producer, and put each insert in the producer that uses it (`producers.md`, rules 1 and 7) |
| `toString()` joins fragments for the parameters, the URL and the response | A class for each of them (`producers.md`, rule 2) |

## 9. Where the rest is

- The cache, the two return shapes of an insert, enrichments and
  variants: `engine.md`.
- The base factory (`toTsOasOperationProjectionBase`), `List`,
  `FunctionParameter`, `toPathTemplate` and import forms:
  `typescript.md`.
- How the model generator you insert into renders a schema:
  `model.md`.
- Accumulators (many subjects in one definition): `engine.md`, "Two
  shapes of generator".
