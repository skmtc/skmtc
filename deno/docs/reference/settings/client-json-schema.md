# skmtc.config.json schema

> The complete shape of `.skmtc/<project>/.settings/skmtc.config.json` —
> the user-facing project configuration file.

`skmtc.config.json` is where users specify the schema source, the output
location, the operation filters, and per-generator enrichments. It's
the most-edited file in a Skmtc project after `deno.json`.

## Location

```
.skmtc/<project>/.settings/skmtc.config.json
```

`client.json` is the old, deprecated name of this file, and it still
works. The CLI reads `client.json` when `skmtc.config.json` does not
exist. When both files exist, the CLI reads `skmtc.config.json`,
ignores `client.json`, and prints a warning. Each run that reads an
old name prints one deprecation warning on stderr.

To change to the new names, run `skmtc migrate config <project>` (see
[migrate](../cli/migrate.md#skmtc-migrate-config)). A command that
writes the config writes to the file it read. Only `migrate config`
renames the file.

Created by `skmtc init` with minimal contents. Edited directly by
users; the CLI doesn't provide a granular `set` subcommand for
individual fields.

## Top-level shape

```jsonc
{
  // Optional. URL or path to the schema source.
  // When set, `skmtc generate <project>` works without a schema arg.
  "source": "./openapi.json",

  // Optional hub bindings (see the top-level field entries below):
  // `project` is the `skmtc push`/`pull` destination, `api` the
  // registered hub schema, `serverUrl` switches `generate` to run
  // against a deployed stack instead of the local bundle.
  "project": "@acme/mobile-api",
  "api": "@acme/orders",
  "serverUrl": "https://stack.example.dev",

  "settings": {
    // Required. The on-disk root for generated output AND the
    // bundler @ alias root. Must be relative.
    "basePath": "src/generated",

    // Optional. Allow-list filter. Empty array or absent = no filter.
    "include": [],

    // Optional. Deny-list filter. Applied after include.
    "skip": [],

    // Optional. Per-generator, per-operation user overrides.
    // Routing keys depend on each generator's projection-base kind;
    // see settings.enrichments below.
    "enrichments": {},

    // Optional. Advanced — for multi-package outputs.
    "packages": [],

    // Optional. Gen-maps (provenance sidecars) — off unless enabled.
    "anchors": { "enabled": true, "out": ".maps" },

    // Optional. How the OpenAPI parser reads schemas it cannot read faithfully.
    "parse": { "allOf": "latestWins" },

    // Optional. Preview/hub concern; ignored by the engine.
    "inputDirs": ["src/fields"]
  }
}
```

The top-level `source` is intentionally outside `settings` (legacy
shape; will likely move under `settings` in a future major).

## Fields

### `source` (top-level, optional)

URL or path to the OpenAPI / GraphQL schema. Supported forms:

- HTTPS URL: `"https://api.example.com/openapi.json"`
- HTTP URL: `"http://localhost:3000/schema.json"`
- Relative path: `"./openapi.json"` (relative to the Skmtc root)
- Absolute path: `"/path/to/openapi.json"`

When set, `skmtc generate <project>` reads the source from here. When
absent, `generate` requires the schema as a positional argument.

Supported file types:

- JSON OpenAPI (Swagger 2, or OpenAPI 3.0.x, 3.1.x or 3.2.x — Swagger 2
  is converted to 3.0; 3.0, 3.1 and 3.2 keep their version)
- YAML OpenAPI (the same versions; converted from YAML to JSON first)
- GraphQL SDL (`.graphql` extension or content-type-detected)

The file type is inferred from the URL extension first, then the
`Content-Type` response header for URLs, then content sniffing.

### `project` (top-level, optional)

skmtc-hub push destination in `@<account>/<slug>` form (the account
may be a user or an org) — analogous to a git remote. Consumed by
`skmtc push` and `skmtc pull` as the default destination when the
`--project` flag is absent. Ignored by `skmtc generate`.

### `api` (top-level, optional)

skmtc-hub API binding in `@<account>/<slug>` form — the registered
hub schema this project's `source` maps to. Recorded by
`skmtc project create` (the schema-register write-back) so a re-run
versions the same API instead of creating a duplicate. Ignored by
`skmtc generate`.

### `serverUrl` (top-level, optional)

URL of a deployed stack server. When set, `skmtc generate` runs
**remotely** against that stack instead of the local bundle — no
local bundle is built. Leave unset for normal local generation.

### `projectKey` (top-level, optional)

Accepted by the validator (`core/types/Settings.ts`'s
`skmtcClientConfig` schema) but not currently read by the CLI or
engine. Vestigial; safe to omit.

### `settings.basePath` (required at init; optional in runtime parse)

The on-disk root for generated output AND the `@` alias root in the
consuming app's bundler.

Required vs optional has two layers:

- **At `init` time**, `basePath` is a positional argument. Without
  it, `skmtc init <project>` uses the folder that the app's `@/`
  alias points to. With no alias to read, a run with `--no-input` or
  `--json` exits with a recipe error. A run at a terminal asks for
  the folder.
- **In the runtime `skmtc.config.json` parse**, the field is `v.optional`
  (`core/types/Settings.ts`'s `clientSettings` schema). Removing it
  from an existing `skmtc.config.json` won't fail validation. `doctor` will
  flag the missing field via `project-base-path/<project>`, but the
  parser tolerates it.

In practice every project that has actually run `init` will have
the field set. Treat it as required for normal workflows; don't
rely on the runtime parse tolerance.

**Constraints:**

- Must be relative (absolute paths rejected at `init` time, and
  flagged by the `project-base-path` doctor check otherwise)
- Should match the consuming app's bundler `@` alias config

**Example values:**

- `"src"` — for a Vite/Next app whose `@` → `./src`
- `"mobile-app/src"` — for a monorepo with a `mobile-app` subdir
- `"src/generated"` — for projects that segregate generated code

See [projects-and-workspaces concept](../../concepts/projects-and-workspaces.md#basepath-alignment-with-the-consuming-app)
for the alignment requirement.

### `settings.include` (optional)

Allow-list filter for which operations/models should be processed.

Three entry shapes:

```jsonc
"include": [
  // 1. Whole-generator: every operation/model this generator handles
  "@skmtc/gen-zod",

  // 2. Per-operation: specific (path, method) pairs
  {
    "@skmtc/gen-shadcn-form": {
      "/customers": ["post"],
      "/orders": ["post", "put"]
    }
  },

  // 3. Per-model: specific refNames
  {
    "@skmtc/gen-zod": ["UserModel", "OrderModel"]
  }
]
```

**Semantics:**

- Empty array or absent → no filter active; everything runs
  (backwards-compatible default).
- Generators *not* mentioned in a non-empty `include` are silently
  excluded.
- For generators *mentioned* in `include`:
  - String form ("whole generator"): everything from the generator
    runs.
  - Object form (per-operation or per-model): only matched items
    run; unmatched items are skipped with `result: 'skipped'` in
    the manifest.
- Matching is exact — no wildcards.

**Use case**: opt-in generators like form/table/page-shell that
would otherwise produce dozens of files per endpoint. Configure
`include` to enable only the operations the team actually wants forms
for.

### `settings.skip` (optional)

Deny-list filter. Same three entry shapes as `include`.

**Order of evaluation in the engine:**

```
isSupported (capability) → include (allow) → skip (deny)
```

An item present in both `include` and `skip` is skipped. An item not
mentioned in either passes if `include` is empty/absent; passes if
`include` is non-empty *and* mentions this generator with a matching
entry.

**Use case**: turn off specific operations that the team has
decided not to support (deprecated endpoints, internal-only paths,
etc.) without changing the generator code.

### `settings.enrichments` (optional)

Per-generator, per-operation user overrides. The routing keys
under each generator depend on the generator's projection-base
kind:

| Factory | Key path |
|---|---|
| `toOasOperationProjectionBase` | `enrichments[generatorId][operation.path][operation.method][variant]` |
| `toModelProjectionBase` | `enrichments[generatorId][refName][variant]` |
| `toGqlOperationProjectionBase` | `enrichments[generatorId][rootKind][fieldName][variant]` |
| `toWebhookProjectionBase` | `enrichments[generatorId][webhookName][method][variant]` |

The value beneath the trailing `[variant]` key is the leaf payload
— its shape is declared by the generator's Valibot schema in
`gen-x/src/enrichments.ts`. The `variant` level defaults to `'main'`
when no variants are declared; whenever any variant is declared,
`'main'` MUST be present. See [`concepts/variants.md`](../../concepts/variants.md).

Example for an OAS operation generator:

```jsonc
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "/contacts": {
        "post": {
          "main": {
            "title": "Create Contact",
            "submitLabel": "Save",
            "fields": [
              { "moduleSelect": { "schemaPath": ["officeIds"] }, "label": "Offices", "references": "GetOffices" }
            ]
          }
        }
      }
    }
  }
}
```

Two reserved keys sit beside the routing keys: `_stack` at the top
level is one leaf every generator in the run can read, and
`_generator` inside a generator's slot is that generator's run-wide
leaf. Every other key is a generator id or a subject name and must
not start with `_`. A generator accepts a value at a reserved key only
when its schema declares that scope; a scope declared `v.undefined()`
rejects any value.

A wrong-typed value fails the run. The run writes no files, and the
files and manifest of the last good run stay. The `RUN_FAILED` issue
in the output of `skmtc generate` (`parseIssues` with `--json`) names
each wrong value's place in `settings.enrichments`. A key the schema
does not declare is dropped and reported as `UNKNOWN_ENRICHMENT_KEY`
on `manifest.enrichmentWarnings`; a routing key that matches nothing
is reported as `UNCONSUMED_ENRICHMENT` or `UNKNOWN_GENERATOR_ID`.
`skmtc doctor` re-reads those warnings between runs.

See [enrichments-shape reference](enrichments-shape.md) and
[enrichments concept](../../concepts/enrichments.md).

### `settings.packages` (optional, advanced)

For projects that write code into multiple packages (e.g., a
monorepo where types and validators land in different workspace
packages). Each entry names a package root folder (`rootPath`,
forward from `basePath`, no `..`) and optionally the name a file
outside it imports it by (`moduleName`). The language package reads
this at render time to write cross-file imports: same package →
`@/` from that package's root; another package → the target root's
`moduleName`; no package → the path as the generator wrote it.

A root is a folder, not a string prefix — `packages/sdk` does not
contain `packages/sdk-legacy` — and spelling does not matter
(`./packages/sdk/` and `packages/sdk` are one root). Roots may nest: a
nested root is a subpath export of the package around it
(`@acme/sdk/models` under `@acme/sdk`). The schema rejects a root
listed twice and the workspace root itself (`.`) as a package root.
Render fails when a file outside a root imports it and the root has
no `moduleName`, and when a file inside a package imports a
workspace-root path that no package holds.
See [projects-and-workspaces.md](../../concepts/projects-and-workspaces.md#how-a-file-is-routed)
for the routing model and
[How to generate into multiple packages](../../using/how-to/generate-into-multiple-packages.md)
for the steps and every error message.

Most projects don't need this. Default: `[]`.

### `settings.anchors` (optional)

Gen-maps (provenance) configuration. Two fields:

- **`enabled`** (boolean) — master switch. `true` emits a sidecar per
  generated source file plus a project-level generation map; `false`
  or omitted runs generation as if gen-maps didn't exist, with zero
  overhead.
- **`out`** (string, optional) — output directory for sidecars and
  the generation map, relative to `.skmtc/<project>/`. Defaults to
  `".maps"`. The `skmtc init` template gitignores the `.maps` subtree
  by default, since sidecars are build output, not source.

The sidecar and generation-map formats are engine-internal; the keys above are the full user-facing surface.

### `settings.parse` (optional)

Sets how the OpenAPI parser reads a schema that it cannot read
faithfully. All fields are optional. The default of each field gives
the usual parse. Default: `{}`. In core, the type is `ParseSettings`
and the Valibot schema is `parseSettings`.

`settings.system` is the old, deprecated name of this key, and it
still works. Core reads `system` when `parse` does not exist. When the
config has both keys, `parse` wins and core logs one warning. To move the key, run
`skmtc migrate config <project>`. The deprecated core names are
`SystemSettings` and `systemSettings`.

- **`allOf`** — `"strict"` (default) or `"latestWins"`. With
  `latestWins`, where the members of an `allOf` contradict, the value
  of the later member wins. Each such schema logs one
  `ALLOF_CONTRADICTION` warning.
- **`not`** — `"strict"` (default) or `"unknown"`. With `unknown`, a
  schema with `not` parses with its other keywords. The `not` stays on
  the schema as an unknown value that core does not read.
- **`anyOf`** — `"union"` (default) or `"unknown"`. With `union`, the
  parser reads an `anyOf` as a union, the same as a `oneOf`. It merges
  the keywords next to the `anyOf` into each member. With `unknown`,
  the parser reads some `anyOf` schemas as any value. This occurs when
  two or more members are not `null`, and one of them is not a single
  value.
  The schema keeps its other keywords, and a `null` member makes it
  nullable. Each such schema logs one `ANYOF_AS_UNKNOWN` warning. An
  `anyOf` with one member, or an `anyOf` of single values such as
  `string | number`, parses as it does with `union`.
- **`danglingRefs`** — the kinds of `$ref` that can name nothing in the
  document. The kinds are `"schema"`, `"parameter"`, `"requestBody"`,
  `"response"`, `"header"`, `"securityScheme"`, `"example"`, `"link"`
  and `"allOfMember"`. The default is `[]`. Each place that has such a
  `$ref` logs one `DANGLING_REF` issue. A `$ref` in a loop of `$ref`s
  (`A` is a `$ref` to `B`, and `B` to `A`) also names nothing.
  - A kind that is not in the list gives an error. The parser removes
    the item that has the `$ref`, and each item that refers to that item
    (`INVALID_DEPENDENCY_REF`).
  - A kind in the list gives a warning, and the `$ref` stays. When a
    generator resolves the `$ref`, core throws a `DanglingRefError`. The
    generator can catch the error and write a different value, for
    example `unknown`.
  - Core merges the members of an `allOf` during the parse, so a
    generator does not see them. With `"allOfMember"` in the list, core
    leaves out a member that names nothing. The model then has no
    properties from that member. Without it, the parser removes the item
    that has the `allOf`. `"schema"` does not cover this case, but it
    covers a `$ref` that `intersections` keeps. Core also merges in a
    `oneOf` or an `anyOf`. It merges the `allOf` of a member,
    and each member with the keywords next to the union. The same rule
    applies there.

  A `$ref` to an item of the wrong kind (`REF_TYPE_MISMATCH`) is always
  an error, and this field does not change it.
- **`intersections`** — `"cycles"` (default), `"all"` or `"merge"`. Sets
  which `$ref`s the parser keeps as references where it would merge their
  target into a schema. The members of an `allOf` are such `$ref`s. So
  are the members of a `oneOf` or an `anyOf`, when a keyword next to it
  merges into each member. A property that two merged members both have
  is one `allOf` of the two, so the same rule applies. The schema is then
  an [`OasIntersection`](../api/oas-schema-variants.md#oasintersection--type-intersection)
  of the references and one schema that the other members merge into.
  - With `cycles`, the parser keeps a `$ref` that closes a cycle. The
    target of such a `$ref` leads back, through any `$ref`s, to the
    schema that has it.
  - With `all`, the parser keeps each such `$ref`. Each subtype that
    has an `allOf` of two or more members is then an intersection.
  - With `merge`, the parser keeps none. A `$ref` that closes a cycle can
    then make the parse run out of memory.

  A union with an intersection as a member is not discriminable
  (`OasUnion.isDiscriminable`). Some libraries do not take an
  intersection as a member of a discriminated union.

  An `allOf` of one `$ref` is a reference with the keywords next to it.
  One exception is a union member with a keyword that merges into it: it
  is an intersection.

  `additionalProperties: false` next to an `allOf` with a kept `$ref`
  closes only the member that is not a reference.
- **`responseContradictions`** — `"strict"` (default) or `"unknown"`.
  Reserved. The validator accepts it, but the parser does not read it.

With `strict`, a schema whose `allOf` members contradict, or a schema
with `not`, fails with an `INVALID_SCHEMA` error. The parser then
removes each item that refers to that schema
(`INVALID_DEPENDENCY_REF`). See
[error codes](../error-codes.md).

### `settings.inputDirs` (optional)

Preview input-matcher discovery directories, project-root relative
(for example `"src/fields"`, `"src/inputs"`). A preview/hub concern:
the generation engine ignores it. Declared in the schema so the CLI
preserves it when reading `skmtc.config.json` and carries it through
`skmtc push` to the hub.

### `settings.formatter` (optional)

Shell command the CLI runs over freshly written artifacts after each
`generate`, for example `"npx prettier --write"` or `"deno fmt"`. The
written file paths are appended (shell-quoted) and the command runs
via `sh -c` from the app root, so project-local configs and binaries
resolve normally.

A host concern: the generation engine itself never formats — render
output stays canonical. The hook exists so on-disk files match the
consumer's own code style. The writer records the formatted content's
hash in `generated.lock.json` so an unchanged render whose disk bytes
still match can skip the rewrite (keeping mtimes stable for
file-watchers); a formatter-config change alone doesn't trigger a
mass rewrite — files converge to the new style when their render
changes or after the repo is reformatted.

Guard rails: a crashing or missing formatter is never destructive —
files land unformatted and a warning goes to stderr.

### `settings.generatedSuffix` (optional)

Filename suffix the engine injects into every projection export path,
before the extension: a `toExportPath` returning `@/forms/CreateForm.tsx`
produces `@/forms/CreateForm.generated.tsx`. Defaults to
`".generated"`; set `""` to disable injection entirely.

Injection happens when the `toExportPath` result is stored into
`ContentSettings` (the single place export paths enter the engine),
so definition cache keys, import specifiers, previews, and the
manifest all carry the suffix consistently. It is idempotent —
generators that hardcode the suffix in `toExportPath` keep producing
identical paths — which is also the migration path: existing
generators are unaffected, new generators omit the suffix and let the
engine inject it.

Explicit `destinationPath` arguments (`register`, `registerInto`,
`registerJson`) are **not** suffixed — they name real files verbatim,
so a generator emitting `package.json` or a hand-named barrel is never
renamed.

The suffix marks a file as engine-owned (overwritten on every
generate). Changing it mid-project renames every generated file on the
next run — the stale-artifact prune removes the old names and imports
regenerate, but expect a large diff.

### `settings.ejected` (optional)

Export paths of generated files the user has taken ownership of, in
their owned, suffix-less form — for example `"@/types/user.tsx"`. This
is the authoritative ejected set: for each member, the engine stores
the owned path into `ContentSettings` instead of the suffixed one (so
definition cache keys, peer import specifiers, previews, and the
manifest all reference the owned file), and the CLI never writes or
deletes the file — not during generate's stale-artifact prune and not
during `skmtc clean`. The item still renders in memory; its content is
the input for drift detection.

Maintained by [`skmtc eject`](../cli/eject.md) /
[`skmtc adopt`](../cli/adopt.md), which also perform the rename and
record provenance metadata in `.settings/ejections.json`. A hand-added
entry is honored identically (it just has no recorded metadata).

### `settings.schemaSource` (accepted, unused)

Accepted by the validator (`core/types/Settings.ts`'s
`clientSettings` schema) but not read by the CLI or engine — the
schema source lives at the **top-level** `source` field. Vestigial;
safe to omit.

## Examples

### Minimal

```json
{
  "source": "./openapi.json",
  "settings": {
    "basePath": "src/generated"
  }
}
```

The default state after `skmtc init` (with a schema source manually
added).

### With enrichments

```jsonc
{
  "source": "./openapi.json",
  "settings": {
    "basePath": "src/generated",
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/contacts": {
          "post": { "title": "Create Contact", "submitLabel": "Create" },
          "put":  { "title": "Edit Contact",   "submitLabel": "Save" }
        }
      }
    }
  }
}
```

Per-operation form titles and submit labels for the contact CRUD.

### With include/skip filters

```jsonc
{
  "source": "./openapi.json",
  "settings": {
    "basePath": "src/generated",
    "include": [
      "@skmtc/gen-zod",
      "@skmtc/gen-typescript",
      {
        "@skmtc/gen-shadcn-form": {
          "/customers": ["post"],
          "/orders": ["post"]
        }
      }
    ],
    "skip": [
      {
        "@skmtc/gen-typescript": ["DeprecatedUser", "InternalAuditLog"]
      }
    ]
  }
}
```

- Zod and TypeScript generators run on everything
- Form generator runs only on the two specified POST endpoints
- Two model refnames are excluded from TypeScript generation

### Full example with all fields

```jsonc
{
  "source": "https://api.example.com/v2/openapi.json",
  "settings": {
    "basePath": "mobile-app/src",
    "include": [
      "@skmtc/gen-zod",
      "@skmtc/gen-typescript",
      "@skmtc/gen-tanstack-query-fetch-zod",
      {
        "@skmtc/gen-shadcn-form": {
          "/customers": ["post", "put"],
          "/orders": ["post"]
        }
      }
    ],
    "skip": [],
    "enrichments": {
      "@skmtc/gen-shadcn-form": {
        "/customers": {
          "post": { "title": "Create Customer", "submitLabel": "Create" }
        }
      }
    },
    "packages": []
  }
}
```

## Validation

`skmtc.config.json` is parsed as JSON (strict — no comments allowed in the
actual file; JSONC isn't supported). The top-level shape is then
validated by the engine before generation.

Validation errors at parse time:

- Invalid JSON syntax → CLI exits with a parse error
- Absolute `basePath` → recipe error at `init` time (also flagged
  later by the `project-base-path/<project>` doctor check)
- Unknown fields under `settings.enrichments[gen]` → silently
  stripped (Valibot's default)

Missing `settings.basePath` is tolerated by the runtime parser
itself, but `doctor` flags it (`project-base-path/<project>`
returns `warning` when unset, `error` when absolute). `init`'s
own argument parser rejects a missing positional `basePath`
upfront with a recipe error.

## Editing workflows

`skmtc.config.json` is intended for direct user editing. The CLI has
no command that sets a key by name. One flag writes one key:
`skmtc generate <project> <schema> --save` stores `source`.

Some workflows that touch `skmtc.config.json`:

- **`skmtc init`** writes the initial minimal version
- **`skmtc migrate config`** renames `client.json` and moves
  `settings.system` to `settings.parse`
- **`skmtc generate --save`** writes `source` from its schema argument
- Everything else is manual: enrichments, include/skip. `install`,
  `clone`, `create`, and `remove` do **not**
  modify `skmtc.config.json` — they only mutate `deno.json#imports` (and
  delete local source dirs in the case of `remove`).

After editing, the next `skmtc generate` picks up the new config.
No rebundle needed — `skmtc.config.json` is runtime config, not bundle
code.

## See also

- [enrichments-shape reference](enrichments-shape.md) — the routing structure
- [source-resolution reference](source-resolution.md) — how `source` is resolved
- [enrichments concept](../../concepts/enrichments.md) — mental model
- [projects-and-workspaces concept](../../concepts/projects-and-workspaces.md) — where this file lives
- [How to configure enrichments](../../using/how-to/configure-enrichments.md) — task-level guidance
- [How to generate into multiple packages](../../using/how-to/generate-into-multiple-packages.md) — `settings.packages` step by step
