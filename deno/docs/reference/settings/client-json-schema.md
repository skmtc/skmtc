# client.json schema

> The complete shape of `.skmtc/<project>/.settings/client.json` —
> the user-facing project configuration file.

`client.json` is where users specify the schema source, the output
location, the operation filters, and per-generator enrichments. It's
the most-edited file in a SKMTC project after `deno.json`.

## Location

```
.skmtc/<project>/.settings/client.json
```

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
- Relative path: `"./openapi.json"` (relative to the SKMTC root)
- Absolute path: `"/path/to/openapi.json"`

When set, `skmtc generate <project>` reads the source from here. When
absent, `generate` requires the schema as a positional argument.

Supported file types:

- JSON OpenAPI (any of v2, v3, v3.1 — auto-converted to v3)
- YAML OpenAPI (auto-converted from YAML to JSON, then to v3)
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
**remotely** against that stack instead of the local bundle — the
local bundle-freshness gate is skipped, since there is no local
bundle in play. Leave unset for normal local generation.

### `projectKey` (top-level, optional)

Accepted by the validator (`core/types/Settings.ts`'s
`skmtcClientConfig` schema) but not currently read by the CLI or
engine. Vestigial; safe to omit.

### `settings.basePath` (required at init; optional in runtime parse)

The on-disk root for generated output AND the `@` alias root in the
consuming app's bundler.

Required vs optional has two layers:

- **At `init` time**, `basePath` is a required positional argument
  — `skmtc init <project> <basePath>` exits with a recipe error if
  the argument is missing.
- **In the runtime `client.json` parse**, the field is `v.optional`
  (`core/types/Settings.ts`'s `clientSettings` schema). Removing it
  from an existing `client.json` won't fail validation. `doctor` will
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
          "title": "Create Contact",
          "submitLabel": "Save",
          "fields": [
            { "id": "officeIds", "references": "GetOffices", "label": "Offices" }
          ]
        }
      }
    }
  }
}
```

Unknown fields are stripped silently; type mismatches surface as
parse errors.

See [enrichments-shape reference](enrichments-shape.md) and
[enrichments concept](../../concepts/enrichments.md).

### `settings.packages` (optional, advanced)

For projects that write code into multiple packages (e.g., a
monorepo where types and validators land in different workspace
packages). Each entry maps a path prefix to a package name; the
engine uses this when rendering cross-package imports.

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

See [attribution and gen-maps concept](../../concepts/attribution-and-gen-maps.md).

### `settings.inputDirs` (optional)

Preview input-matcher discovery directories, project-root relative
(for example `"src/fields"`, `"src/inputs"`). A preview/hub concern:
the generation engine ignores it. Declared in the schema so the CLI
preserves it when reading `client.json` and carries it through
`skmtc push` to the hub.

### `settings.formatter` (optional)

Shell command the CLI runs over freshly written artifacts after each
`generate`, for example `"npx prettier --write"` or `"deno fmt"`. The
written file paths are appended (shell-quoted) and the command runs
via `sh -c` from the app root, so project-local configs and binaries
resolve normally.

A host concern: the generation engine itself never formats — render
output stays canonical. The hook exists so on-disk files match the
consumer's own code style, and so edit detection can compare *through*
the formatter: the writer records the formatted content's hash in
`generated.lock.json`, and a formatter-config change is resolved by
re-formatting the stored canonical baseline under the current config
rather than being misread as a hand edit.

Guard rails: a crashing or missing formatter is never destructive —
files land unformatted, a warning goes to stderr, and comparison
degrades to raw content.

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

`client.json` is parsed as JSON (strict — no comments allowed in the
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

`client.json` is intended for direct user editing. The CLI doesn't
expose subcommands like `skmtc set source ./schema.json` —
hand-editing is the recommended approach.

Some workflows that touch `client.json`:

- **`skmtc init`** writes the initial minimal version
- Everything else is manual: enrichments, include/skip, source
  pinning. `install`, `clone`, `create`, and `remove` do **not**
  modify `client.json` — they only mutate `deno.json#imports` (and
  delete local source dirs in the case of `remove`).

After editing, the next `skmtc generate` picks up the new config.
No rebundle needed — `client.json` is runtime config, not bundle
code.

## See also

- [enrichments-shape reference](enrichments-shape.md) — the routing structure
- [source-resolution reference](source-resolution.md) — how `source` is resolved
- [enrichments concept](../../concepts/enrichments.md) — mental model
- [projects-and-workspaces concept](../../concepts/projects-and-workspaces.md) — where this file lives
- [`skmtc-cli` skill §6](../../skills/skmtc-cli/SKILL.md) — operational guidance
