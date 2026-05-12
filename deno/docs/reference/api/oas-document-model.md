# OAS document model

> The parsed OpenAPI v3 document and its components: `OasDocument`,
> `OasOperation`, `OasResponse`, `OasParameter`, `OasRequestBody`,
> `OasHeader`, `OasMediaType`, `OasExample`, and `OasComponents`. These
> are what the Parse phase produces and what generators read during
> Generate.

The OAS object model is a flat collection of sibling classes, each
carrying an `oasType` discriminator. There is **no shared base class
hierarchy** — the same design that applies to [OasSchema variants](oas-schema-variants.md)
applies here. Most generator-facing parameters are typed as
`X | OasRef<'x'>` because parsed OAS components may be either inline
or refs.

## Source

`skmtc/deno/core/oas/`

| Class | File |
|-------|------|
| `OasDocument` | `document/Document.ts` |
| `OasOperation` | `operation/Operation.ts` |
| `OasResponse` | `response/Response.ts` |
| `OasParameter` | `parameter/Parameter.ts` |
| `OasRequestBody` | `requestBody/RequestBody.ts` |
| `OasHeader` | `header/Header.ts` |
| `OasMediaType` | `mediaType/MediaType.ts` |
| `OasExample` | `example/Example.ts` |
| `OasComponents` | `components/Components.ts` |

## OasDocument

The top-level parsed OpenAPI v3 document.

```ts
class OasDocument {
  oasType: 'openapi'
  openapi: string                          // version string, e.g., '3.0.3'
  info: OasInfo
  operations: OasOperation[]                // flattened paths → operations
  components: OasComponents | undefined
  tags: OasTag[] | undefined
  security: OasSecurityRequirement[] | undefined
  externalDocs: OasExternalDocs | undefined
  extensionFields: Record<string, unknown> | undefined

  constructor(args: { ... })

  toJsonSchema(options?): OpenAPIV3.Document
  toJSON(): object
}
```

### Properties

#### `operations: OasOperation[]`

The operations are flattened — the OAS paths-and-methods nesting is
folded into a single array. Each entry carries its `path` and
`method` as properties.

This is the entry point for **operation generators**. They iterate
`document.operations` and emit one Projection per operation.

```ts
for (const operation of document.operations) {
  if (operation.method === 'post') {
    // ...
  }
}
```

#### `components: OasComponents | undefined`

The reusable components (schemas, parameters, responses, etc.). This is
where `OasRef` lookups land when `resolve()` is called.

This is the entry point for **model generators**. They iterate
`document.components.schemas` (or another component dictionary) and
emit one Projection per component.

```ts
for (const [refName, schema] of Object.entries(document.components?.schemas ?? {})) {
  // emit a model Projection for this schema
}
```

#### `info: OasInfo`

The `info` block from the OAS document. Useful metadata: title,
version, description. Sometimes referenced when emitting a generated
file header.

### Methods

The methods on `OasDocument` are mostly serialization helpers
(`toJSON`, `toJsonSchema`). Generator code rarely calls them — the
parsed model is read directly via properties.

## OasOperation

The most-used class for operation generators. Represents one endpoint
(path + method + spec metadata).

```ts
class OasOperation {
  oasType: 'operation'
  path: string                                          // e.g., '/users/{id}'
  method: Method                                        // 'get' | 'post' | 'put' | ...
  operationId: string | undefined
  summary: string | undefined
  description: string | undefined
  tags: string[] | undefined
  parameters: (OasParameter | OasRef<'parameter'>)[] | undefined
  requestBody: OasRequestBody | OasRef<'requestBody'> | undefined
  responses: Record<string, OasResponse | OasRef<'response'>> | undefined
  security: OasSecurityRequirement[] | undefined
  deprecated: boolean | undefined
  extensionFields: Record<string, unknown> | undefined

  constructor(args: { ... })

  // Body & response helpers
  toRequestBody<V>(map: (args: ToRequestBodyArgs) => V, mediaType?: string): V | undefined
  toSuccessResponse(): OasResponse | OasRef<'response'> | undefined
  toSuccessResponseCode(): string | undefined

  // Parameter helpers
  toParams(filter?: OasParameterLocation[]): OasParameter[]
  toParametersObject(filter?: OasParameterLocation[]): OasObject

  // Serialization
  toJsonSchema(options?): OpenAPIV3.OperationObject
  toJSON(): object
}
```

### Properties

#### `path: string` and `method: Method`

The path template (e.g., `'/users/{id}'`) and HTTP method (`'get'`,
`'post'`, etc.). Together they uniquely identify the operation within
the document.

The `Method` type is the lowercase union of HTTP verbs:
`'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'`.

#### `operationId: string | undefined`

The `operationId` field from the spec. Used as the level-3 key in
[enrichments routing](../settings/enrichments-shape.md) and often as
the basis for generated identifier names via `toEndpointName(operation)`.

When absent, generators fall back to deriving a name from `path` +
`method`. The `toEndpointName` helper handles this fallback.

#### `parameters: (OasParameter | OasRef<'parameter'>)[] | undefined`

The operation's parameters — path, query, header, cookie. May be
inline or refs. Use `toParams()` or `toParametersObject()` to access
them after resolving refs.

#### `requestBody: OasRequestBody | OasRef<'requestBody'> | undefined`

The request body (for `POST`, `PUT`, `PATCH`, etc.). May be inline or
ref. Use `toRequestBody()` to access the contained schema with the
mapper pattern.

#### `responses: Record<string, OasResponse | OasRef<'response'>>`

Map of HTTP status code → response. Codes are strings (`'200'`,
`'201'`, `'4XX'`, `'default'`). Use `toSuccessResponse()` to find the
2xx response.

### Methods

#### `toRequestBody<V>(map, mediaType?): V | undefined`

The canonical pattern for reading the request body schema. The mapper
receives `{ schema, requestBody, mediaType }` and returns whatever the
caller needs:

```ts
const schema = operation.toRequestBody(({ schema }) => schema)
// → OasSchema | OasRef<'schema'> | undefined

const isObject = operation.toRequestBody(({ schema }) => {
  return !schema.isRef() && schema.type === 'object'
})
// → boolean | undefined (undefined if no request body)
```

The optional `mediaType` parameter picks a specific content type
(default: `'application/json'`).

**Why the mapper pattern?** The request body is wrapped in
`OasRequestBody → OasMediaType → schema`. Without the mapper, every
caller would walk that chain manually
(`requestBody?.resolve()?.content?.['application/json']?.schema`).
The mapper consolidates the unwrap into a single call.

#### `toSuccessResponse(): OasResponse | OasRef<'response'> | undefined`

Returns the first 2xx response from `responses`, or `'default'` if no
2xx is present. The lookup order matches generator conventions for
"what's the happy-path response."

```ts
const response = operation.toSuccessResponse()
const schema = response?.resolve()?.toSchema()
```

#### `toSuccessResponseCode(): string | undefined`

The status code (`'200'`, `'201'`, etc.) matching the response that
`toSuccessResponse()` returns. Useful when the generated code needs to
include the expected response code (e.g., a fetch wrapper that
asserts `response.status === 200`).

#### `toParams(filter?): OasParameter[]`

Returns the resolved parameters (refs resolved). The optional
`filter` parameter restricts by location:

```ts
const pathParams = operation.toParams(['path'])
const queryParams = operation.toParams(['query'])
const allButPath = operation.toParams(['query', 'header', 'cookie'])
```

#### `toParametersObject(filter?): OasObject`

Returns an `OasObject` whose properties are the operation's
parameters (after ref resolution). This is the structural
representation used to generate parameter-typed objects:

```ts
const argsObject = operation.toParametersObject(['path', 'query'])
// → OasObject with properties for each path/query param

const argsZod = generate(argsObject)
// → "z.object({ userId: z.string(), q: z.string().optional() })"
```

The required-ness from each parameter's `required` flag is
propagated into the object's `required` array.

#### `toJsonSchema(options)`

Serializes back to an OpenAPI-spec-shaped operation object. Useful
for diagnostics and pass-through (e.g., re-emitting the original spec
into a generated artifact). Not used by stock generators in their
hot paths.

### Examples

#### Generating a typed fetch wrapper

```ts
override toString(): string {
  const requestBody = this.operation.toRequestBody(({ schema }) => schema)
  const successCode = this.operation.toSuccessResponseCode() ?? '200'
  const args = this.operation.toParametersObject(['path', 'query'])

  return `
    async function ${this.fnName}(args: ${args}) {
      const response = await fetch(...)
      if (response.status !== ${successCode}) throw new Error('...')
      return response.json()
    }
  `
}
```

## OasRequestBody

```ts
class OasRequestBody {
  oasType: 'requestBody'
  description: string | undefined
  content: Record<string, OasMediaType>      // 'application/json' → OasMediaType
  required: boolean | undefined
  extensionFields: Record<string, unknown> | undefined

  isRef(): false
  resolve(): this
  resolveOnce(): this
  toSchema(mediaType?: string): OasSchema | OasRef<'schema'> | undefined
  toJsonSchema(options?): OpenAPIV3.RequestBodyObject
}
```

`toSchema()` is a shortcut for `content[mediaType].schema`:

```ts
const schema = requestBody.toSchema()                  // application/json by default
const xmlSchema = requestBody.toSchema('application/xml')
```

## OasResponse

```ts
class OasResponse {
  oasType: 'response'
  description: string                          // required by OAS spec
  headers: Record<string, OasHeader | OasRef<'header'>> | undefined
  content: Record<string, OasMediaType> | undefined
  extensionFields: Record<string, unknown> | undefined

  isRef(): false
  resolve(): this
  resolveOnce(): this
  toSchema(mediaType?: string): OasSchema | OasRef<'schema'> | undefined
  toJsonSchema(options?): OpenAPIV3.ResponseObject
}
```

The shape mirrors `OasRequestBody`, with the addition of `headers`.
The `toSchema()` shortcut is the same.

## OasParameter

```ts
class OasParameter {
  oasType: 'parameter'
  name: string
  location: OasParameterLocation               // 'path' | 'query' | 'header' | 'cookie'
  description: string | undefined
  required: boolean | undefined
  schema: OasSchema | OasRef<'schema'> | undefined
  deprecated: boolean | undefined
  example: unknown
  extensionFields: Record<string, unknown> | undefined

  isRef(): false
  resolve(): this
  resolveOnce(): this
  toSchema(): OasSchema | OasRef<'schema'> | undefined
  toJsonSchema(options?): OpenAPIV3.ParameterObject
}
```

The discriminator is `location` (not `in`, which is the OAS spec's
field name — the parser renames it to avoid the reserved-word
collision in some TypeScript contexts).

`toSchema()` returns the parameter's schema (which is most of what
generators care about).

## OasHeader

Similar to `OasParameter` but without `name` or `location` (the
header name lives in the parent map's key):

```ts
class OasHeader {
  oasType: 'header'
  description: string | undefined
  required: boolean | undefined
  schema: OasSchema | OasRef<'schema'> | undefined
  deprecated: boolean | undefined
  extensionFields: Record<string, unknown> | undefined

  isRef(): false
  resolve(): this
  resolveOnce(): this
}
```

## OasMediaType

The wrapper around a single content-type's schema and examples:

```ts
class OasMediaType {
  oasType: 'mediaType'
  mediaType: string                           // e.g., 'application/json'
  schema: OasSchema | OasRef<'schema'> | undefined
  examples: Record<string, OasExample | OasRef<'example'>> | undefined
  encoding: Record<string, OasEncoding> | undefined
  extensionFields: Record<string, unknown> | undefined
}
```

Most generators access `OasMediaType` indirectly via
`requestBody.toSchema()` or `response.toSchema()`. Direct access is
rare.

## OasExample

```ts
class OasExample {
  oasType: 'example'
  summary: string | undefined
  description: string | undefined
  value: unknown
  externalValue: string | undefined
  extensionFields: Record<string, unknown> | undefined
}
```

Carries inline example values from the OAS spec. Stock generators
mostly ignore examples; they exist in the model for completeness and
for generators that emit doc-fixture data.

## OasComponents

The reusable-components dictionary. Holds the named schemas,
parameters, responses, etc. that `OasRef` lookups resolve against:

```ts
class OasComponents {
  oasType: 'components'
  schemas: Record<string, OasSchema> | undefined
  responses: Record<string, OasResponse> | undefined
  parameters: Record<string, OasParameter> | undefined
  examples: Record<string, OasExample> | undefined
  requestBodies: Record<string, OasRequestBody> | undefined
  headers: Record<string, OasHeader> | undefined
  securitySchemes: Record<string, OasSecurityScheme> | undefined
  pathItems: Record<string, OasPathItem> | undefined
}
```

`OasRef<T>.resolve()` looks up the ref against the appropriate
dictionary (e.g., `'#/components/schemas/User'` →
`components.schemas['User']`).

The values in these dictionaries are always resolved at parse time —
they're never refs themselves. Refs in nested positions (e.g., a
property of a component schema pointing at another component) are
preserved as refs.

## Common patterns

### Reading the request body schema

```ts
const schema = operation.toRequestBody(({ schema }) => schema)
// schema is OasSchema | OasRef<'schema'> | undefined
```

### Reading the success response schema

```ts
const responseRef = operation.toSuccessResponse()
const response = responseRef?.resolve()
const schema = response?.toSchema()
```

### Iterating path parameters

```ts
const pathParams = operation.toParams(['path'])
for (const param of pathParams) {
  const paramSchema = param.toSchema()?.resolve()
  // ...
}
```

### Building an args object for a typed function

```ts
const args = operation.toParametersObject(['path', 'query'])
// args is OasObject — pass to the schema generator
const argsType = generate(args)
```

## Common questions

### Why are parameters and responses sometimes refs and sometimes inline?

OAS allows both: a parameter can be defined inline on the operation,
or named in `components.parameters` and referenced. The parser
preserves whichever the spec uses, so generator code must handle
both. `resolve()` chases the ref chain when needed.

### Why does `toRequestBody` use a mapper instead of returning the body directly?

The mapper centralizes the OasMediaType unwrap step. Without it,
every caller would write
`requestBody?.resolve()?.content?.['application/json']?.schema` — a
brittle chain. The mapper lets each caller specify exactly what
shape they need from the body (the schema, the full media type,
specific examples, etc.).

### What if an operation has no `operationId`?

The `toEndpointName(operation)` helper in `core/helpers/` produces a
fallback name based on the path and method. Generator code should
prefer `toEndpointName(operation)` over reading `operation.operationId`
directly — the helper handles the fallback uniformly.

### Why is `OasComponents.schemas` a `Record<string, OasSchema>` (not refs)?

Components are the resolution targets. If `components.schemas.User`
were a ref to another schema, refs would have to chain through
components — much more complex. The parser ensures component values
are concrete (resolved at parse), while refs in nested positions
(inside a component) are preserved.

### Where do `OasRef<'parameter'>`, `OasRef<'response'>`, etc. live?

The generic `OasRef<T>` is parameterized by the resolution-target
type. Each appearance is in the position where the corresponding
component could be referenced. See [API: OasRef](oas-ref.md) for the
generic class.

## Related types

```ts
// Discriminator across the OAS model (excluding schemas)
type OasComponentType =
  | OasSchema
  | OasResponse
  | OasParameter
  | OasExample
  | OasRequestBody
  | OasHeader
  | OasSecurityScheme

// HTTP method literal
type Method = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

// Parameter location
type OasParameterLocation = 'path' | 'query' | 'header' | 'cookie'
```

## See also

- [API: OasSchema variants](oas-schema-variants.md) — the schema half of the model
- [API: OasRef](oas-ref.md) — references and resolution
- [API: ParseContext](parse-context.md) — how this model is built
- [API: GenerateContext](generate-context.md) — how generators consume it
- [Refs and resolution concept](../../concepts/refs-and-resolution.md) — how refs resolve through components
- [Glossary: OasDocument, OasOperation, OasRef](../glossary.md)
