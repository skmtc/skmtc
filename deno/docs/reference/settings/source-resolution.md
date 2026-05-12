# Source resolution

> How the CLI locates the schema source, loads it, and normalizes it
> to a JSON-cloneable OAS 3.0 document (or a raw GraphQL SDL string)
> before handing it to the engine.

The schema source can come from a CLI argument, the project's
`client.json`, or — when running interactively — a prompt. The CLI
walks a precedence chain to find one, fetches it (HTTP or
filesystem), detects its format, and normalizes it to the engine's
canonical shape.

The work in this doc happens **host-side** — entirely in the CLI
process, before the worker spawns. This is the same `structuredClone`-
imposed boundary documented in the
[worker runtime concept](../../concepts/the-worker-runtime.md): OAS
must be a JSON-cloneable object before crossing into the worker;
GraphQL stays as a raw SDL string.

## Resolution order

The CLI walks this precedence chain to find a source. The first
non-empty value wins.

### 1. CLI argument

```bash
skmtc generate my-api ./alternate-schema.json
```

A positional argument after the project name overrides everything
else. This is the **most-explicit** form and the recommended way to
do one-off generates against a different spec (staging URL, fixture
file, branch-specific schema) without mutating the project's
`client.json`.

### 2. Top-level `source` in client.json

```jsonc
{
  "source": "./openapi.json",
  "settings": { ... }
}
```

The project's pinned source — read from
`.skmtc/<project>/.settings/client.json`. The `source` field lives
at the **top level** of `client.json`, **not** inside `settings`.
The CLI reads it as `parsed.source` (see
`cli/lib/agent-context-headless.ts:157–158`).

This is the typical configured state. See the [`source` field
reference in client-json-schema.md](client-json-schema.md#source-top-level-optional)
for the shape.

> A `settings.schemaSource` field appears in the `ClientSettings`
> Valibot schema (`core/types/Settings.ts`) but is not currently
> read by any consumer — treat it as a dead field. Pin the schema
> via the top-level `source` field, not `settings.schemaSource`.

### 3. Interactive prompt (TTY only)

When neither of the above is set, and the CLI is running
interactively (not in `--no-input` or `--json` mode), the CLI
prompts:

```
? Schema source (URL or path):
```

The user's response is used for this run only. The CLI does **not**
write the response back to `client.json` — that's an explicit user
action.

### Strict-mode behavior

When `--no-input` is set (implicitly by `--json` or explicitly) and
neither the CLI argument nor `client.json#source` provides a source,
the CLI exits with code `2`:

```
Error: no schema source provided (in strict mode)
  Provide one as a positional argument or set source in client.json
```

This matches the broader CLI convention: strict mode never falls
back to prompts.

## Supported formats

After resolution, the CLI fetches (or reads) the source and detects
its format. Three formats are supported.

### JSON

OpenAPI as JSON. Any of:

- **OpenAPI v2 (Swagger)** — `swagger: "2.0"`
- **OpenAPI v3.0.x** — `openapi: "3.0.x"`
- **OpenAPI v3.1.x** — `openapi: "3.1.x"`

JSON is the canonical interchange form. Most public OpenAPI specs
publish as JSON; the CLI handles them directly.

### YAML

OpenAPI as YAML — same version coverage as JSON. The CLI parses
YAML to JSON internally, then proceeds as if the source were JSON.

YAML comments are dropped during conversion (JSON has no comment
syntax). Multi-document YAML files (`---` separated) are not
supported — the CLI reads only the first document.

### GraphQL SDL

GraphQL Schema Definition Language as plain text:

```graphql
type Query {
  users: [User!]!
}

type User {
  id: ID!
  name: String!
}
```

Unlike OAS, GraphQL SDL is **not** parsed host-side. The CLI reads
the file contents (or fetches the URL response), validates that it
looks like SDL, and forwards the raw string into the worker. The
worker parses it via the GraphQL runtime there.

### Format detection

The CLI detects format in this order:

1. **File extension** — `.json`, `.yaml`/`.yml`, `.graphql`/`.gql`
2. **HTTP `Content-Type` header** — `application/json`,
   `application/yaml` / `text/yaml`, `application/graphql` /
   `text/graphql`
3. **Content sniffing** — first non-whitespace byte:
   - `{` → JSON
   - `swagger:` / `openapi:` at line start → YAML
   - `type ` / `schema ` / `scalar ` at line start → GraphQL SDL

If detection fails (e.g., a `.txt` file with ambiguous contents),
the CLI exits with a clear error rather than guessing.

## Pre-parse normalization

OAS sources are normalized to the engine's canonical shape — **OAS
3.0**, as a JSON-cloneable object — before crossing into the worker.

This normalization is the load-bearing step that lets the rest of
the engine assume a single OAS version.

### Swagger 2 → OAS 3.0

Swagger (OpenAPI 2.0) is converted to OAS 3.0 via the standard
upconversion pipeline. The semantic shifts handled:

- **Body parameters** → `requestBody`
- **`consumes` / `produces`** → per-operation `content` keys with
  media types
- **`definitions`** → `components.schemas`
- **`parameters`** (top-level) → `components.parameters`
- **`responses`** (top-level) → `components.responses`
- **Security definitions** rewritten to OAS 3.0 shape

Conversion is mostly mechanical but can fail on edge cases (specs
that exploit Swagger-2-specific extensions, for example). Failures
surface as:

```
Error: failed to convert Swagger 2 to OAS 3.0: <reason>
```

When this happens, the user's options are:

1. Pre-convert the spec themselves (using `swagger2openapi` or a
   similar tool) and pass the resulting OAS 3.0 file
2. Fix the source spec to remove the incompatible extension

### OAS 3.1 → OAS 3.0

OpenAPI 3.1 adopts JSON Schema 2020-12, which introduces semantic
changes that don't all map cleanly to OAS 3.0:

| OAS 3.1 feature | Handling in 3.0 |
|-----------------|-----------------|
| `type: ["string", "null"]` (type arrays) | Rewritten to `type: "string"` + `nullable: true` |
| `examples` (array, plural) | First entry used as `example` (singular) |
| `$dynamicRef` | Not supported; surfaces as a parse error |
| Const-only schemas | Translated to single-element enum |
| `unevaluatedProperties` | Dropped (not supported in 3.0) |

The conversion is **lossy in places** — specifically when 3.1
features have no 3.0 equivalent. The CLI emits a warning per
dropped feature so users know which parts of their spec aren't
represented in the generated output.

### GraphQL stays as SDL string

GraphQL is the exception to the "normalize before crossing" rule.
The CLI:

1. Reads/fetches the SDL content
2. Does a lightweight format check (it must contain a `type`
   declaration)
3. Passes the raw string into `toArtifacts` as
   `{ type: 'gql', sdl: '...' }`
4. The worker parses the SDL using the GraphQL runtime

The reason: `graphql.parse()` produces an AST with class instances
that **`structuredClone` cannot transfer**. Cloning a parsed AST
across the worker boundary would either strip prototypes (breaking
the AST) or throw. Keeping the SDL as a string sidesteps the issue
— parsing happens *inside* the worker where the AST stays.

See [the worker runtime concept](../../concepts/the-worker-runtime.md)
for the broader reasoning.

## Remote sources

When the source is an HTTP or HTTPS URL, the CLI uses standard
`fetch()` to retrieve it.

### Authentication

The CLI does not currently expose a built-in authentication
mechanism for remote schemas. Two approaches when the spec endpoint
requires auth:

1. **Bundle the spec to a local file** and point `source` at the
   file. This is the recommended approach for any spec behind auth:
   it eliminates the network dependency at generate time, makes the
   spec version-controllable, and avoids storing credentials in
   `client.json`.
2. **Run a local proxy** that injects the credential, and point
   `source` at the local proxy URL.

The CLI explicitly **does not** support credential fields in
`client.json` — to prevent credentials from being committed
alongside generation config.

### Timeouts

The CLI uses `fetch`'s default timeout behavior, with no explicit
timeout override. Large specs over slow connections may hang;
the user can cancel with Ctrl+C.

### Redirects

The CLI follows redirects (standard `fetch()` behavior). A typical
case: an `/openapi` endpoint that 302-redirects to `/openapi.json`.

### HTTP status handling

| Status | CLI behavior |
|--------|--------------|
| `200` | Proceed with format detection |
| `301` / `302` | Follow redirect |
| `401` / `403` | Exit with auth-required error |
| `404` | Exit with "schema not found" error |
| `5xx` | Exit with server-error message (no retry) |

The CLI does not currently retry transient failures. A flaky spec
endpoint should be wrapped by a local proxy or bundled to a file.

### Caching

The CLI does **not** cache remote spec responses across runs. Every
`generate` (or `bundle`, where the spec is read for validation)
re-fetches.

The reason: caching would mask spec changes — users updating the
spec on the server would see stale generated output until the cache
invalidated. The trade-off (slower repeat runs) is acceptable
because the CLI runs are infrequent (not per-build).

`skmtc agent-context` reports `schema.lastFetched` for orientation,
but that's metadata only — the CLI doesn't use it to skip fetches.

### External `$ref`s in OAS specs

A spec may reference external files:

```json
{ "$ref": "./shared/User.json#/components/schemas/User" }
```

The CLI does **not** automatically resolve cross-file `$ref`s.
External refs are preserved in the document and surface as parse
errors when the engine's `OasRef.resolve()` can't find them in the
loaded document's `components`.

The fix: pre-bundle the spec into a single file before pointing
`source` at it. Tools like `swagger-cli bundle` or `@apidevtools/swagger-parser`
inline external refs.

## Path resolution

Relative paths in `source` are resolved against the **workspace
root**, not the project directory or the CLI's current working
directory.

```jsonc
// .skmtc/my-api/.settings/client.json
{ "source": "./openapi.json" }
```

This `./openapi.json` resolves to `<workspace-root>/openapi.json`,
not `<workspace-root>/.skmtc/my-api/openapi.json`.

The reason: most teams keep one spec at the repo root that multiple
projects might consume. Resolving relative to the workspace root
makes that the default.

For project-local specs, use a path that climbs back to the
project's `.skmtc/` directory:

```jsonc
{ "source": "./.skmtc/my-api/openapi.json" }
```

Absolute paths are resolved as-is.

## Examples

### URL source, JSON

```jsonc
// client.json
{ "source": "https://api.example.com/openapi.json" }
```

The CLI fetches the URL, detects JSON via the `Content-Type` header,
runs version normalization (probably no-op for a 3.0 spec), and
passes the result to the worker.

### Local YAML, Swagger 2

```jsonc
// client.json
{ "source": "./legacy-swagger.yaml" }
```

The CLI reads the file, detects YAML via the `.yaml` extension,
parses YAML to JSON, detects Swagger 2 via the `swagger: "2.0"`
field, runs the upconversion, and passes OAS 3.0 to the worker.

### GraphQL SDL from URL

```jsonc
// client.json
{ "source": "https://api.example.com/graphql.schema" }
```

The CLI fetches, detects SDL via content (or `Content-Type:
application/graphql`), and passes the raw string into the worker.

### Override via CLI argument

```bash
skmtc generate my-api ./fixtures/staging-spec.json --json
```

The CLI uses `./fixtures/staging-spec.json` instead of whatever
`client.json#source` says. The fixture path resolves against the
workspace root.

## Common questions

### Why is OAS normalized to 3.0 specifically (not 3.1)?

The engine's parser was first written against OAS 3.0. Upgrading to
3.1-native would require touching the parser to handle JSON Schema
2020-12 semantics (type arrays, dynamic refs, etc.). The
normalize-to-3.0 approach lets the engine stay 3.0-shaped while
still accepting 3.1 input.

A future engine version may target 3.1 natively, but the
normalization layer would still exist for 2.0 and 3.0 sources.

### Why doesn't the CLI cache fetched specs?

To avoid masking spec changes. The trade-off: slower repeat runs.
Most users find this acceptable because they don't run `generate`
multiple times in a row against the same remote URL — local-file
sources are caching-free already.

If repeat-run performance becomes a problem, the workaround is to
bundle the spec to a local file and point `source` at it.

### What if my spec uses OAS 3.1 features that don't map to 3.0?

The CLI surfaces warnings for each dropped feature. The most common
mismatches:

- **Type arrays** (`type: ["string", "null"]`) — translated to
  `type: "string"` + `nullable: true`. Generators see the
  `nullable` and handle it.
- **`$dynamicRef`** — not supported. Parse fails with a clear
  error. The fix: replace dynamic refs with plain `$ref` (which
  may require restructuring the spec).
- **Plural `examples`** — only the first example survives. Spec
  reads with examples-by-name lose the names.

For specs that rely heavily on 3.1-specific features, the cleanest
fix is to author the spec as 3.0 from the start.

### What if my spec has external `$ref`s?

Pre-bundle the spec with a tool like `swagger-cli bundle`:

```bash
swagger-cli bundle ./openapi.yaml --outfile ./bundled.openapi.json
```

Then point `source` at the bundled file. The CLI doesn't do this
bundling automatically — too many edge cases (HTTP refs,
auth-required refs, circular refs across files).

### Why is the path resolution rooted at the workspace, not the project?

So a single spec file at the workspace root can be consumed by
multiple projects. This matches how most teams structure their
repos: one OpenAPI spec, one or more SKMTC projects emitting
different generator combinations from it.

For project-private specs, use a path that includes the project
directory: `./.skmtc/<project>/openapi.json`.

### How does GraphQL source resolution differ from OAS?

GraphQL takes the "stay-as-string" path because parsing it would
produce a non-cloneable AST. The CLI:

1. Resolves the source (same precedence as OAS)
2. Reads/fetches the SDL
3. Does a *lightweight* format check (looking for a `type`
   declaration)
4. Forwards the raw string into the worker

The worker parses the SDL inside its context (via the GraphQL
runtime), then proceeds as if it were any other parsed source.

### What's the difference between `source` and the engine's `document` parameter?

`source` (in `client.json`) is the **user-facing string** — a URL
or path. The engine's `document` parameter (on
[`toArtifacts`](../api/to-artifacts.md)) is the **resolved value**
— either a parsed OAS object or a GraphQL SDL string.

Source resolution is the work that bridges them. The CLI does this
work; the engine accepts the resolved form.

## See also

- [Reference: client.json schema — `source` field](client-json-schema.md#source-top-level-optional) — the configuration shape
- [Reference: API — toArtifacts](../api/to-artifacts.md) — the engine entry that accepts the resolved `document`
- [The worker runtime concept](../../concepts/the-worker-runtime.md) — why OAS is host-parsed and GraphQL is worker-parsed
- [The three phases concept](../../concepts/the-three-phases.md) — where source resolution sits in the lifecycle (it's the step *before* Parse)
- [Refs and resolution concept](../../concepts/refs-and-resolution.md) — internal `$ref` handling (distinct from external $ref bundling discussed here)
- [`skmtc-debug` skill](../../skills/skmtc-debug/SKILL.md) — diagnosing source resolution failures
- [Glossary: schema, OAS, SDL, structuredClone](../glossary.md)
