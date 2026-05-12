# Error codes

> Canonical list of parse-issue types, generate-time errors, and CLI
> exit codes. Each entry: when it fires, what message accompanies it,
> and the typical remediation.

The error model is described conceptually in
[`concepts/error-handling-philosophy.md`](../concepts/error-handling-philosophy.md).
This file is the lookup reference for specific codes.

## Issue levels

Two levels in the parse-issue stream:

- **`error`** — fatal for the affected item. The item is dropped from
  output; consumers of failed refs are cascade-pruned. The CLI exits
  with code 1 when any error-level issue is present.
- **`warning`** — informational. Output is still produced; the
  warning is logged for diagnosis. The CLI exit code is unaffected.

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
- Missing `items` on an array schema
- Cycle in `allOf` references

### `INVALID_DEPENDENCY_REF` — error

**When:** A schema or operation referenced a `$ref` target that
failed to parse. The referencing item is cascade-pruned from the
output.

**Typical message:** something like `Schema "X" referenced by Y
failed to parse, removing Y from output`.

**Example location:** `paths./users.post.requestBody`

**Remediation:** Find the *upstream* `INVALID_SCHEMA` issue that
broke the ref target. Fix the upstream schema; the dependent
`INVALID_DEPENDENCY_REF` issues typically resolve on their own.

**Cascade depth:** one hop. If `Post` references `User` and
`Comment` references `Post`, breaking `User` prunes `Post` (one
hop). `Comment` would fail later (at generate time) with a
`Ref "..." not found` exception — see the generate-time errors
below.

### `MISSING_OBJECT_TYPE` — warning

**When:** A schema has `properties` but no `type: 'object'`. SKMTC
infers the type as `object` and proceeds; the warning surfaces the
inference.

**Typical message:** `Schema has 'properties' but no 'type' field;
inferring 'object'`.

**Remediation:** Add `type: object` to the schema in the OpenAPI
source. The output is still produced correctly, but explicit typing
is preferred for clarity.

### `MISSING_ARRAY_TYPE` — warning

Same shape as `MISSING_OBJECT_TYPE` but for arrays — schema has
`items` without `type: 'array'`.

### `MISSING_BOOLEAN_TYPE` — warning

Schema has a boolean `default` or `example` without `type: 'boolean'`.

### `MISSING_STRING_TYPE` — warning

Schema has a string `default`, `example`, string-only `enum`, or a
recognized string `format` (`date`, `date-time`, etc.) without
`type: 'string'`.

### `UNEXPECTED_PROPERTY` — warning

A schema has properties that aren't part of the OAS 3.0 spec
position. SKMTC ignores the unknown keys but logs them.

**Typical message:** `Unexpected property '<key>' at <location>`.

**Remediation:** Either fix the OpenAPI document (rename or remove
the property) or accept that the property is being ignored. Common
sources are vendor extensions written without the conventional
`x-` prefix.

### `INVALID_OPERATION` — error

**When:** A path operation (`tryParseAt`-wrapped per-method parser)
threw. The single `(path, method)` pair is dropped; the rest of the
document continues to parse.

**Remediation:** Read the operation at the indicated location.
Causes mirror `INVALID_SCHEMA` (bad `requestBody`, malformed
parameters, etc.).

### `INVALID_PARAMETER` — error

**When:** A reusable parameter under `components.parameters` failed
to parse via `tryParseAt`. The parameter is dropped; any operation
that `$ref`s it surfaces a cascading `INVALID_DEPENDENCY_REF` /
generate-time `Ref ... not found`.

### `INVALID_RESPONSE` — error

**When:** A response entry (under an operation's `responses` map)
failed to parse via `tryParseAt`. The single `(status, response)`
pair is dropped.

### `INVALID_EXAMPLE` — warning

**When:** An `example` value doesn't conform to its declared schema
(e.g., a number-typed `example` on a `type: array` schema). The
example is dropped; the schema is otherwise unchanged.

### `INVALID_DEFAULT` — warning

**When:** A schema's `default` value doesn't conform to its
declared type (e.g., a string default on an enum that has no
matching member, or a non-array default on an array schema). The
default is dropped; the schema is otherwise unchanged.

### `INVALID_FORMAT` — warning

**When:** A numeric or integer schema's `format` isn't a recognized
OAS numeric format. The format is dropped; the type proceeds
without it.

### `UNEXPECTED_FORMAT` — warning

**When:** A string schema's `format` isn't a recognized OAS string
format (`date`, `date-time`, `byte`, `binary`, `password`, `email`,
`uri`, `uuid`, etc.). The format is preserved but flagged; user
code may need to handle the custom format.

### `INVALID_NULLABLE` — warning

**When:** A schema's `nullable` field conflicts with its other
type constraints (e.g., `nullable: true` on a schema that has no
type). SKMTC degrades gracefully and emits a warning.

### `EXAMPLE_AND_EXAMPLES_DEFINED` — warning

**When:** A schema defines both `example` (singular, OAS 3.0) and
`examples` (plural, OAS 3.1) at the same node. SKMTC picks one
deterministically (singular wins) and warns.

### `INVALID_ENUM` — reserved

Declared in the `OasIssueType` union but not currently emitted from
any parser. Reserved for future use; if you encounter this in a
manifest, it's from a build of `@skmtc/core` newer than this doc.

## GraphQL parse-issue types

### `INVALID_TYPE_DEFINITION` — error

**When:** A GraphQL type definition failed to parse. The type is
dropped from the registry; downstream consumers are pruned.

### `INVALID_DEPENDENCY_REF` — error

The GraphQL flavor of the shared `INVALID_DEPENDENCY_REF` code (the
same identifier appears in both `OasIssueType` and `GqlIssueType`).
Cascade-prunes consumers when a referenced GraphQL type fails to
parse.

**Discriminator:** `protocol: 'gql'` on the `ParseIssue` —
generators that read by code alone should also check `protocol`.

### `SKIPPED_FIELD_ARGUMENTS` — warning

**When:** A GraphQL field has arguments the engine doesn't yet
support (e.g., complex input types in certain positions). The field
is included but its arguments are dropped.

### `NESTED_LIST_LOSSY` — warning

**When:** A GraphQL field has a nested-list type (`[[T]]` and
deeper). SKMTC can't represent nested lists as a single `OasArray`
in v1, so it collapses to `OasUnknown`. The field is preserved but
loses its inner-list shape.

### `DROPPED_DIRECTIVE` — warning

**When:** A field or type carries a directive SKMTC doesn't model.
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

Declared in the `GqlIssueType` union but not currently emitted from
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

**Example:** generator A's `toIdentifier` for a `POST /users`
operation produces `useCreateUsers`. Generator B's `toIdentifier`
for the same operation also produces `useCreateUsers`. Both want
the same `exportPath`. Collision.

**Remediation:**

- Identify the two generators by their `generatorKey` values in the
  message.
- Clone one of them.
- Edit its `toIdentifier` to add a discriminating prefix or suffix
  (e.g., `useCreateUsers` → `useCreateUsersMutation`).

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

### `bundle.js is out of sync with deno.json — add: …`

**When:** Strict-mode `skmtc generate` detected that the
`worker.ts`/`bundle.js` was built against a different set of
generators than `deno.json#imports` currently declares. The error
tells you which generator IDs are out of sync.

**Remediation:**

```bash
skmtc bundle <project>
```

Then re-run `skmtc generate`.

### `No matching export … for import "<X>"` (during `deno bundle`)

**When:** `deno bundle` failed because of peer-dependency version
skew. Usually `@skmtc/core` has a version in `deno.json` that
doesn't expose the symbol the generator imports.

**Remediation:**

```bash
skmtc doctor --json
```

The `project-core-pin/<project>` check identifies the mismatch and
emits the canonical fix in its `hint` field.

## CLI exit codes

| Code | Meaning |
|---|---|
| `0` | Success (including documented no-ops like a remote-only `bundle`) |
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
`StackTrail` accumulates as the parser descends; on issue emission,
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

- [Error handling philosophy](../concepts/error-handling-philosophy.md) — the two-tier model
- [Refs and resolution](../concepts/refs-and-resolution.md) — how ref errors work
- [Manifest format](manifest-format.md) — the `parseIssues` array structure
- [`skmtc-debug` skill](../skills/skmtc-debug/SKILL.md) — operational diagnostic workflows
