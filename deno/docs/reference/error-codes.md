# Error codes

> Canonical list of parse-issue types, generate-time errors, and CLI
> exit codes. Each entry: when it fires, what message accompanies it,
> and the typical remediation.

The error model is described conceptually in
[`concepts/error-handling-philosophy.md`](../explanation/error-handling-philosophy.md).
This file is the lookup reference for specific codes.

## Find your error

| Where you saw it | What it looks like | Jump to |
|---|---|---|
| `manifest.parseIssues[].type` (OAS source) | `INVALID_SCHEMA`, `INVALID_DEPENDENCY_REF`, `MISSING_*_TYPE`, `UNEXPECTED_PROPERTY`, `INVALID_OPERATION`, … | [OAS parse-issue types](#oas-parse-issue-types) |
| `manifest.parseIssues[].type` (GraphQL source) | `INVALID_TYPE_DEFINITION`, `SKIPPED_FIELD_ARGUMENTS`, `NESTED_LIST_LOSSY`, `DROPPED_DIRECTIVE`, … | [GraphQL parse-issue types](#graphql-parse-issue-types) |
| Thrown on stderr during generate | `Registered definition mismatch: '<X>' in file '<Y>' …` | [Registered definition mismatch](#registered-definition-mismatch) |
| Thrown on stderr during generate | `Max lookups reached` | [Max lookups reached](#max-lookups-reached) |
| Thrown on stderr during generate | `Ref "<$ref>" not found` / `Ref type mismatch for "<$ref>"` | [Ref not found](#ref-ref-not-found) · [Ref type mismatch](#ref-type-mismatch-for-ref) |
| During `skmtc bundle` or the bundle step of generate | `No matching export … for import` | [Generate-time errors](#generate-time-errors) |
| `manifest.enrichmentWarnings[].type` or the "Enrichment warnings" output block | `UNCONSUMED_ENRICHMENT`, `UNKNOWN_ENRICHMENT_KEY`, … | [Enrichment warnings](#enrichment-warnings) |
| Shell `$?` after a run | exit code `0` / `1` / `2` | [CLI exit codes](#cli-exit-codes) |
| A location string like `paths:/users:post:…` | decoding where an issue occurred | [Issue location strings](#issue-location-strings) |

## Issue levels

Three levels in the parse-issue stream:

- **`error`** — fatal for the affected item. The item is dropped from
  output; consumers of failed refs are cascade-pruned. The CLI exits
  with code 1 when any error-level issue is present.
- **`warning`** — a real deviation that was handled. Output is still
  produced; the warning is logged for diagnosis. The CLI exit code is
  unaffected.
- **`debug`** — informational. The parser handled the input
  gracefully and recorded what it assumed or dropped
  (spec-legal-but-lossy or dialect-benign cases). Recorded on the
  manifest like the other levels, but consumers filter `debug` out of
  the default view. The CLI exit code is unaffected.

## OAS parse-issue types

### `INVALID_SCHEMA` — error

**When:** A `tryParseAt`-wrapped per-item parser threw while parsing
a schema component. The schema is dropped from the parsed model.

**Typical message:** the original thrown error's message, prefixed
by location.

**Example location:** `components:schemas:User`

**Remediation:** Read the schema at the indicated location in the
OpenAPI document. The cause is typically:

- Conflicting `allOf` members (incompatible types or constraints)
- Empty `oneOf` / `anyOf` arrays
- Cycle in `allOf` references

**Warning-level variant:** in an OpenAPI 3.0 document, an array schema
with no `items` logs `INVALID_SCHEMA` at level `warning`. The message is
`Array schema has no "items" — treating as an array of unknown values`.
The parse continues, and the items are unknown values. In OpenAPI 3.1
and 3.2, `items` is optional. These documents get unknown items and no
issue.

### `INVALID_DEPENDENCY_REF` — error

**When:** A schema or operation referenced a `$ref` target that
failed to parse. The referencing item is cascade-pruned from the
output. An error in one property of a component removes the whole
component, and the parser prunes its consumers too. A broken
parameter in a path-level `parameters` list removes each operation
on the path that it applies to. An operation that declares its own
parameter with the same `name` and `in` stays, without the broken
parameter.

**Typical message:** `Depends on '#/components/schemas/X', removed
because of the error at '<traceId>:<spanId>:parse:components:schemas:X:properties:p': <the
error's message>`. The location and message are those of the error
that started the removal. The location is the same string as the
`location` of that error in `parseIssues`.

**Example location:** `paths./users.post.requestBody`

**Remediation:** Find the *upstream* `INVALID_SCHEMA` issue that
broke the ref target. Fix the upstream schema; the dependent
`INVALID_DEPENDENCY_REF` issues typically resolve on their own.

**Also when:** In an OpenAPI 3.2 document, a `content` entry has a
`$ref` that does not resolve to an entry in `components.mediaTypes`.
The pointer can be outside `components.mediaTypes`, name an entry that
does not exist, or start a chain of entries that loops back on itself.
The parser removes that content entry and keeps the others. There is
no upstream `INVALID_SCHEMA` issue. Correct the pointer, or add the
entry to `components.mediaTypes`.

**Cascade depth:** transitive. If `Post` references `User` and
`Comment` references `Post`, an error in `User` removes `User` and
prunes both `Post` and `Comment`. Each gets its own
`INVALID_DEPENDENCY_REF`, and each message names the error in
`User`.

### `MISSING_OBJECT_TYPE` — debug

**When:** An OAS 3.0 schema has `properties` but no `type: 'object'`.
Skmtc infers the type as `object` and proceeds; the debug issue
records the inference. Fires from the 3.0 parser only — type-less
schemas are valid in 3.1, so the 3.1 parser is silent here.

**Typical message:** `Object has "properties" property, but is
missing type="object" property`.

**Remediation:** Add `type: object` to the schema in the OpenAPI
source. The output is still produced correctly, but explicit typing
is preferred for clarity.

### `MISSING_ARRAY_TYPE` — warning

Same shape as `MISSING_OBJECT_TYPE` but for arrays — schema has
`items` without `type: 'array'`.

### `MISSING_BOOLEAN_TYPE` — warning

Schema has a boolean `default` or `example` without `type: 'boolean'`.

### `EMPTY_PARAMETER` — warning

**When:** An entry in a `parameters` list or in
`components.parameters` is an empty object `{}` or `null`. The list
can be on a path item, an operation or a webhook. The entry has no
data, so Skmtc removes it and parses the other parameters. A `$ref`
entry, or an entry with at least one key, does not get this warning.

Skmtc also logs this warning for a `parameters` field that is `{}` or
`null` instead of a list. The field can be on a path item, an
operation or a webhook. Skmtc reads the field as no parameters.

**Typical message:** `Empty parameter object; skipped` (entry) or
`Empty parameters field; read as no parameters` (field).

**Example location:** `paths:/mi:parameters:0`,
`components:parameters:<name>` or `paths:/mi:parameters` (field)

**Remediation:** Remove the empty entry or the empty field from the
OpenAPI document.

### `MISSING_RESPONSES` — warning

**When:** An operation or webhook has no `responses`, or `responses`
is `null`. Skmtc keeps the operation and reads it as an operation
with no documented responses. Generators get no responses for it.
`responses` is required in OpenAPI 3.0 and optional in 3.1 and 3.2.
All three versions log this warning. A `responses: {}` logs nothing.

**Typical message:** `Operation has no responses; read as no
documented responses`.

**Example location:** `paths:/pets:post:responses`

**Remediation:** Add the operation's responses to the OpenAPI
document if generators must make response types for it.

### `MISSING_INFO` — warning

**When:** The document has no `info` object, `info` is `null`, or
`info` is not an object. Skmtc reads it as an empty title and
version, and parses and generates the operations as usual. Skmtc
also logs this warning for each of `info.title` and `info.version`
that is absent or not a string, and reads that field as `''`. The
YAML number `version: 1.0` is not a string. `info`, `title` and `version` are
required in OpenAPI 3.0, 3.1 and 3.2.

**Typical messages:** `Document has no info object; read as empty
title and version`, `Info has no string title; read as ''`.

**Example locations:** `info`, `info:version`

**Remediation:** Add `info` with a string `title` and `version` to
the OpenAPI document. Generators that print the title get an empty
one until you do.

### `MISSING_STRING_TYPE` — warning

Schema has a string `default`, `example`, string-only `enum`, or a
recognized string `format` (`date`, `date-time`, etc.) without
`type: 'string'`.

### `UNEXPECTED_PROPERTY` — warning

A schema has properties that aren't part of the OAS 3.0 spec
position. Skmtc ignores the unknown keys but logs them.

**Typical message:** `Unexpected property '<key>' at <location>`.

**Remediation:** Either fix the OpenAPI document (rename or remove
the property) or accept that the property is being ignored. Common
sources are vendor extensions written without the conventional
`x-` prefix.

**Also when:** An OpenAPI 3.2 Media Type Object has `encoding` together
with `prefixEncoding` or `itemEncoding`. The spec does not allow
`encoding` next to them. The location names `encoding`. The parser
keeps all three fields. Remove `encoding` or the other two fields.

### `INVALID_OPERATION` — error or warning

**When:** A path operation (`tryParseAt`-wrapped per-method parser)
threw. The single `(path, method)` pair is dropped; the rest of the
document continues to parse. Webhook operations fire the same code
through the same isolation.

Parse also logs this code for a bad `servers` entry at the document,
path item, operation or webhook level. A bad entry is not a Server
Object, or its `url` is not a string. Parse drops only that entry and
continues with the operations.

Parse also logs this code for an operation or webhook that a broken
path-level parameter applies to. Each broken entry first gets an
[`INVALID_PARAMETER`](#invalid_parameter--error-or-warning) error.
The entry applies to every operation on the path, unless the
operation has an inline parameter with the same `name` and `in`.
That parameter overrides the entry, and Skmtc keeps the operation.

An entry without a string `name` and `in` applies to every operation
on the path. A path-level `parameters` field that is not a list also
applies to every operation on the path. The exception is `{}` or
`null`: see [`EMPTY_PARAMETER`](#empty_parameter--warning). The
message is `Path-level parameter <location> failed to parse:
<message>`. The `<location>` is the place of the entry in the
document, for example `paths:/items:parameters:0`.

Parse also drops an operation or webhook when its
effective security names a scheme it cannot use. The effective
security is the operation's own `security`, or the root `security`
when the operation has none. `security: []` inherits nothing, and an
empty requirement `{}` names no scheme, so neither drops anything.
The messages are:

- `Requires security scheme '<name>', which failed to parse`: the
  scheme is in `components.securitySchemes` but has its own
  [`INVALID_SECURITY_SCHEME`](#invalid_security_scheme--error) error.
- `Requires security scheme '<name>', which is not defined in
  components.securitySchemes`: no scheme has that name.
- `Inherits root security, which is not a list of security
  requirement objects`: the root `security` has the wrong shape.
- `Inherits root security, which requires security scheme '<name>',
  …`: the root `security` has one of the two scheme problems above.

One message names all the schemes of one kind. Parse also drops an
operation when its `security` is not a list. The same occurs when an
entry does not map each scheme name to a list of scopes.

A root `security` with one of these problems logs this code as a
`warning` at `security`. Parse leaves the root `security` out of the
document and drops the operations that inherit it.

A scheme of type `mutualTLS` does not drop its operations. Skmtc does
not parse this type yet, so the scheme logs `INVALID_SECURITY_SCHEME`
and parse keeps its operations.

**Example location:** `paths:/accounts:post` (operation),
`servers:1` (servers entry), `security` (root `security`)

**Remediation:** Read the operation at the indicated location.
Causes mirror `INVALID_SCHEMA` (bad `requestBody`, malformed
parameters, etc.). If the message names a path-level parameter, fix
that parameter: it drops each operation it applies to. For a
`servers` entry, make the entry a Server Object with a string `url`,
or remove it. A `responses` that is not
an object (an array, a string, a number) also drops the operation.
The message is `"responses" must be an object of status codes, got
<type>`. An operation without `responses` is not an error: see
[`MISSING_RESPONSES`](#missing_responses--warning).

For a security message, fix or define the scheme that the message
names. For a shape problem, make `security` a list of objects. Each
object maps a scheme name to a list of scopes.

### `UNSUPPORTED_OPERATION_METHOD` — warning

**When:** An OpenAPI 3.2 path item or webhook has an
`additionalOperations` entry. Skmtc does not model methods outside
the fixed path item fields, so it drops the operation and logs one
warning for each entry.

**Example location:** `paths:/files:additionalOperations:COPY`

**Remediation:** None is necessary if you do not need the operation.
No generator renders a custom method yet.

### `INVALID_PARAMETER` — error or warning

**When (error):** A parameter failed to parse, and Skmtc dropped it:

- A reusable parameter under `components.parameters` failed to parse
  via `tryParseAt`. Any operation that `$ref`s it surfaces a cascading
  `INVALID_DEPENDENCY_REF`.
- An OpenAPI 3.2 `in: querystring` parameter does not have exactly one
  `content` media type, or has a `schema`. The operation keeps its other
  parameters.
- A path-level parameter failed to parse, or the path-level
  `parameters` field is not a list. A `{}` or `null` field is not an
  error. See [`EMPTY_PARAMETER`](#empty_parameter--warning). This
  applies to webhooks too. Skmtc drops each operation that the
  parameter applies to, with an
  [`INVALID_OPERATION`](#invalid_operation--error-or-warning) error, and keeps
  the other operations. The location is `paths:<path>:parameters:<index>`,
  or `paths:<path>:parameters` for a broken field.

**When (warning):** An OpenAPI 3.2 operation, together with its path
item, has more than one `in: querystring` parameter, or has an
`in: querystring` parameter and an `in: query` parameter. Skmtc keeps
the parameters. The check reads only inline parameters, not `$ref`
parameters.

### `INVALID_RESPONSE` — error

**When:** A response entry (under an operation's `responses` map)
failed to parse via `tryParseAt`. The single `(status, response)`
pair is dropped.

### `INVALID_REQUEST_BODY` — error

**When:** An entry under `components.requestBodies` failed to parse
in `tryParseAt`. Skmtc drops that entry and keeps the other entries
and the operations. Examples: the entry is `null`, its `content` is
absent or `null`, or its schema has an empty `oneOf` or `anyOf`.

**Example location:** `components:requestBodies:UpdatePet`

**Remediation:** Fix the entry in the OpenAPI document. Until you
do, the artifact of an operation that references the entry by
`$ref` fails with `Ref "…" not found`. Only that artifact fails.

### `INVALID_HEADER` — error

**When:** An entry under `components.headers` failed to parse in
`tryParseAt`. Skmtc drops that entry and keeps the other entries and
the operations. Examples: the entry is `null`, or its schema has an
empty `oneOf` or `anyOf`. When a header inside a response has one of
these errors, Skmtc drops that response as `INVALID_RESPONSE`.

**Example location:** `components:headers:X-Trace-ID`

**Remediation:** Fix the entry in the OpenAPI document. Until you
do, the artifact of a response that references the entry by `$ref`
fails with `Ref "…" not found`. Only that artifact fails.

### `INVALID_SECURITY_SCHEME` — error

**When:** A security scheme under `components.securitySchemes`
failed to parse via `tryParseAt`. The single scheme is dropped; the
rest of the record continues to parse. Parse also drops each operation
or webhook that requires the scheme, with an `INVALID_OPERATION`
error. See its [security case](#invalid_operation--error-or-warning).

**Remediation:** Read the security scheme at the indicated location.
The scheme must be a valid OAS `http` / `apiKey` / `oauth2` /
`openIdConnect` object.

### `INVALID_EXAMPLE` — warning

**When:** An `example` value doesn't conform to its declared schema
(e.g., a number-typed `example` on a `type: array` schema). The
example is dropped; the schema is otherwise unchanged.

**Also when:** An OpenAPI 3.2 Example Object has two value fields
that the spec does not allow together. `value` cannot be next to
`dataValue`, `serializedValue` or `externalValue`. `serializedValue`
cannot be next to `externalValue`. The parser keeps one field by the
order `dataValue`, `value`, `serializedValue`, `externalValue`, and
removes the other. The location names the removed field.

### `INVALID_DEFAULT` — warning

**When:** A schema's `default` value doesn't conform to its
declared type (e.g., a string default on an enum that has no
matching member, or a non-array default on an array schema). The
default is dropped; the schema is otherwise unchanged.

### `INVALID_FORMAT` — debug

**When:** A number or integer schema's `format` isn't one the
internal representation can hold (`format` is an open vocabulary —
for example `decimal`). The format hint is dropped; the type
proceeds without it. Recorded at `debug` because the dropped hint is
informational, not a correctness issue.

**Typical message:** `Invalid format: <format>`.

### `UNEXPECTED_FORMAT` — reserved

Declared in the `OasIssueType` union but not currently logged from
any parser. Reserved; if you encounter this in a manifest, it's from
a build of `@skmtc/core` newer than this doc.

### `INVALID_NULLABLE` — warning

**When:** A schema's `nullable` field conflicts with its other
type constraints (e.g., `nullable: true` on a schema that has no
type). Skmtc degrades gracefully and produces a warning.

### `EXAMPLE_AND_EXAMPLES_DEFINED` — warning

**When:** A schema defines both `example` (singular, OAS 3.0) and
`examples` (plural, OAS 3.1) at the same node. Skmtc picks one
deterministically (singular wins) and warns.

### `INVALID_ENUM` — warning

**When:** An `enum` member doesn't conform to the schema's declared
type (for example a numeric member on a `type: string` schema; a
`null` member is tolerated when the schema is nullable). The whole
enum list is dropped; the schema proceeds without the enum
constraint.

**Remediation:** Fix the offending enum member in the OpenAPI source
so every member matches the schema's type.

### `INVALID_TAG_PARENT` — warning

**When:** The `parent` of an OpenAPI 3.2 tag names a tag that is not
in the top-level `tags` list. Or, the chain of `parent` values from
the tag goes back to the same tag (a cycle). The parser removes
`parent` from the tag and keeps all other fields. In a cycle, each tag on the
cycle loses its `parent`.

**Example location:** `tags:2:parent`

**Remediation:** Point `parent` at the `name` of another tag in the
top-level `tags` list, and make sure no tag is its own ancestor.

### `INVALID_TAG` — warning

**When:** An entry of the top-level `tags` list is not an object, or
its `name` is not a string. Skmtc leaves the entry out and keeps the
other tags. When `tags` is not an array, Skmtc reads the document as
a document with no tags and logs one warning at `tags`. Operations
keep the tag names that they list, also the names of tags that
Skmtc left out.

**Typical messages:** `Tag is not an object with a string name; left
out`, `"tags" must be an array; left out`.

**Example location:** `tags:3`

**Remediation:** Give each tag a string `name`, and write `tags` as
a list.

### `INVALID_EXTERNAL_DOCS` — warning

**When:** An `externalDocs` value is not an object, has no string
`url`, or has a `description` that is not a string. A `null` value
also gets this warning. Skmtc leaves out that `externalDocs`
object and keeps its parent: the document, a tag, an operation, a
webhook or a schema. Skmtc can copy the `externalDocs` of a oneOf
or anyOf schema to each member. Then it logs the warning for each
member.

**Typical message:** `External docs object is invalid (Invalid key:
Expected "url" but received undefined); left out`.

**Example location:** `tags:1:externalDocs`

**Remediation:** Add a string `url` to the `externalDocs` object, or
remove the object.

### `WILDCARD_MEDIA_TYPE` — warning

**When:** A response or request body has a `content` map with a
`*/*` key, no JSON media type, and an object, array, union or `$ref`
schema under `*/*`. The lookups without a media type
(`OasResponse.toSchema()`, `OasOperation.traverse`) then read that
schema as JSON, but the document does not say the format of the body.
There is one issue for each response or body, at its `content` key.
A common source is springdoc, which writes `*/*` for every response.
A Swagger 2.0 document converted by `@skmtc/swagger2openapi` 0.1.4 or
later keeps `*/*` only for a response with no `produces` and a scalar
or untyped schema.

**Remediation:** Name the media type in the source document, for
example `application/json`, or `produces` in Swagger 2.0.

### `NO_JSON_MEDIA_TYPE` — debug

**When:** No lookup without a media type reads the body, and its
`content` keys include a range: `application/*`, or `*/*` with a
scalar schema (a `string` text body, or `format: binary` for a file).
The format of the body is unknown. Read it with an explicit media
type: `toSchema('*/*')`. A body with only specific non-JSON types
(`multipart/form-data`, `application/octet-stream`, `text/plain`)
logs no issue.

A media type counts as JSON when its type and subtype, with
parameters removed, are `application/json` or end in `+json`
(`application/json;v=1.0`, `application/vnd.api+json`,
`application/problem+json`). `text/json`, `application/x-ndjson` and
names without the suffix, such as `application/vnd.goa.error`, do not.

## GraphQL parse-issue types

### `INVALID_TYPE_DEFINITION` — error

**When:** A GraphQL type definition failed to parse. The type is
dropped from the registry; downstream consumers are pruned.

### `INVALID_DEPENDENCY_REF` — error

The GraphQL flavor of the shared `INVALID_DEPENDENCY_REF` code (the
same identifier appears in both `OasIssueType` and `GqlIssueType`).
Cascade-prunes consumers when a referenced GraphQL type fails to
parse. The parser removes the field, union member or operation that
holds the ref; the parent type stays.

**Discriminator:** `protocol: 'gql'` on the `ParseIssue` —
generators that read by code alone should also check `protocol`.

### `SKIPPED_FIELD_ARGUMENTS` — warning

**When:** A GraphQL field has arguments the engine doesn't yet
support (e.g., complex input types in certain positions). The field
is included but its arguments are dropped.

### `NESTED_LIST_LOSSY` — warning

**When:** A GraphQL field has a nested-list type (`[[T]]` and
deeper). Skmtc can't represent nested lists as a single `OasArray`
in v1, so it collapses to `OasUnknown`. The field is preserved but
loses its inner-list shape.

### `DROPPED_DIRECTIVE` — warning

**When:** A field or type carries a directive Skmtc doesn't model.
The directive is silently dropped; the field/type is preserved
without the directive.

**Remediation:** None needed if you don't care about the directive.
If you want it preserved, expose it via `extensionFields` (planned
for v2).

### `UNKNOWN_TYPE_KIND` — error

**When:** A GraphQL type's kind didn't match any known
`isScalarType` / `isObjectType` / `isInputObjectType` /
`isInterfaceType` / `isUnionType` / `isEnumType` check. Defensive
fallback — shouldn't fire under `graphql-js`'s type system. The
field falls back to `OasUnknown`.

### `SKIPPED_FEATURE` — reserved

Declared in the `GqlIssueType` union but not currently logged from
any parser. Reserved for future use; treat similarly to
`INVALID_ENUM` above.

## Generate-time errors

These aren't `ParseIssue`s — they're exceptions raised during the
Generate phase. They typically appear as per-operation result
`'error'` in the manifest with the exception message as the cause.

### `Registered definition mismatch`

**Full message format:** `Registered definition mismatch: '<X>' in
file '<Y>'. Cached key '<A>' does not match new key '<B>'`

**When:** Two generators (or two callers within one generator) tried
to register the same identifier at the same `exportPath`. The
strict Driver-path integrity check (`affirmDefinition`) caught the
collision.

**Example:** generator A's `toIdentifierName` for a `POST /users`
operation produces `useCreateUsers`. Generator B's `toIdentifierName`
for the same operation also produces `useCreateUsers`. Both want
the same `exportPath`. Collision.

**Remediation:**

- Identify the two generators by their `generatorKey` values in the
  message.
- Clone one of them.
- Edit its `toIdentifierName` to add a discriminating prefix or suffix
  (e.g., `useCreateUsers` → `useCreateUsersMutation`).

A configuration cause to check before debugging generator code: a
stray variant key beside `main` in the enrichments block (for
example a misspelled variant name) fans out an extra variant, and on
a generator whose naming ignores the variant this surfaces as a key
mismatch. Check `client.json` variant keys first.

### `Max lookups reached`

**Full message:** `Max lookups reached`

**When:** `OasRef.resolve()` chased a ref chain deeper than 10 hops.
Indicates either a cycle in the OAS document's `$ref`s or a
pathologically deep chain.

**Remediation:**

- Inspect the OpenAPI document at the location indicated in the
  surrounding error context.
- Look for circular `$ref`s (`A → B → A`) or deeply nested ref
  chains.
- Refactor the schema to break the cycle or flatten the chain.

### `Ref "<$ref>" not found`

**When:** `OasRef.resolveOnce()` failed to find the target. The
target either was never present in the OAS document or was
cascade-pruned by an earlier `INVALID_SCHEMA`.

**Remediation:**

- Search the OAS document for `<$ref>`. If it's truly missing, add
  the schema definition.
- If the document defines it but the engine can't find it: look in
  `parseIssues` for an `INVALID_SCHEMA` against that ref's target
  — fixing the upstream parse error resurfaces the ref.

### `Ref type mismatch for "<$ref>"`

**Full message:** `Ref type mismatch for "<$ref>". Expected
"<expectedType>" but got "<actualType>"`

**When:** A `$ref` from a position expecting (say) a schema actually
points at a parameter or response. The type-integrity check fired
during `OasRef.resolveOnce()`.

**Remediation:** The OAS document has a wrong-bucket `$ref`. Move
the target to the correct components bucket, or update the `$ref`
to point at the correct existing target.

### `No matching export … for import "<X>"` (during `deno bundle`)

**When:** `deno bundle` failed because of peer-dependency version
skew. Usually `@skmtc/core` has a version in `deno.json` that
doesn't expose the symbol the generator imports.

**Remediation:**

```bash
skmtc doctor --json
```

The `project-core-pin/<project>` check identifies the mismatch and
provides the canonical fix in its `hint` field.

## Enrichment warnings

Reported on `manifest.enrichmentWarnings` (and as an "Enrichment
warnings" block in CLI output) after every run — the audit of
enrichment config that did not do what you intended. Warn-level and
fail-open: output is never affected. Each entry carries a `path` (the
routing key sequence under `client.json#settings.enrichments`), a
message, and — for near-miss key typos — a `suggestion`.

### `UNCONSUMED_ENRICHMENT` — warning

A configured routing path that no engine lookup consumed: a typo'd
path, method, or model name, or an entry orphaned when the schema
evolved. Remediation: fix the routing key, or delete the entry if the
subject no longer exists.

### `UNKNOWN_GENERATOR_ID` — warning

A top-level enrichments key that matches no generator in the run.
Remediation: fix the id, or install the generator it targets.

### `UNKNOWN_ENRICHMENT_KEY` — warning

A leaf key the generator's enrichment schema does not declare — the
schema strips it before the generator sees it. The message suggests
the nearest declared key when one is close. Remediation: fix the
spelling, or check the generator's reference page for the declared
shape.

### `SKIPPED_SUBJECT_ENRICHMENT` — info

The entry is addressed correctly, but its operation or model is
excluded by `skip`/`include`. Legitimate during temporary skips;
delete the entry if the skip is permanent.

### `SKIPPED_GENERATOR_ENRICHMENT` — info

The whole generator is skipped while enrichments for it exist.

## CLI exit codes

| Code | Meaning |
|---|---|
| `0` | Success (including documented no-ops, e.g. `clean` on a project with no manifest) |
| `1` | Fatal failure — parseIssue at level `error`, typecheck failed, or other unrecoverable error |
| `2` | Required input missing or invalid — recipe error printed to stderr |

Recipe errors at exit code 2 always include:

- An error description
- A `Usage:` line showing the command syntax
- An `Example:` line showing a concrete invocation
- A `Discover:` line pointing at the follow-up command that fetches
  candidate values for the missing argument

The recipe pattern is the "fix it without reading the docs"
contract for agents.

## Issue location strings

Locations are stack-trail paths produced by
`StackTrail.toString()`. The format is colon-separated:

```
paths:/users:post:requestBody:content:application/json:schema:properties:email
```

Each segment is one level deeper in the OAS document. The
`StackTrail` accumulates as the parser descends; on issue logging,
the current trail is stringified.

## Common questions

### How do I get every error-level issue from the last run?

```bash
jq '.parseIssues | map(select(.level == "error"))' \
  .skmtc/<project>/.settings/manifest.json
```

`parseIssues` is **always present** in the manifest — an empty
array means no parse issues fired, not "old core version".

### Can I configure which issue types are warnings vs errors?

No. The level is fixed per type. The rationale: error-level
issues kill the affected item; warning-level issues just log. The
classification is intrinsic to the issue's severity, not a user
preference.

If you want stricter parsing (treat warnings as errors), filter
the manifest's `parseIssues` post-hoc in your CI script and exit
non-zero on any warning of your choice.

### Are GraphQL and OAS errors interchangeable?

No — the `protocol` field on each `ParseIssue` discriminates. OAS
generators won't see GraphQL issue types and vice versa, since
each run processes only one protocol.

## Cross-references

- [Error handling philosophy](../explanation/error-handling-philosophy.md) — the two-tier model
- [Refs and resolution](../concepts/refs-and-resolution.md) — how ref errors work
- [Manifest format](manifest-format.md) — the `parseIssues` array structure
- [How to debug a failing generation](../using/how-to/debug-failing-generation.md) — the diagnostic workflow
