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

  "settings": {
    // Required. The on-disk root for generated output AND the
    // bundler @ alias root. Must be relative.
    "basePath": "src/generated",

    // Optional. Allow-list filter. Empty array or absent = no filter.
    "include": [],

    // Optional. Deny-list filter. Applied after include.
    "skip": [],

    // Optional. Per-generator, per-operation user overrides.
    // Scoped by generatorId → projectionKind → operationOrRefId → projectionKey.
    "enrichments": {},

    // Optional. Advanced — for multi-package outputs.
    "packages": []
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

### `settings.basePath` (required)

The on-disk root for generated output AND the `@` alias root in the
consuming app's bundler.

**Constraints:**

- Must be relative (absolute paths rejected at `init` time)
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

- Empty array or absent → no filter active; everything emits
  (backwards-compatible default).
- Generators *not* mentioned in a non-empty `include` are silently
  excluded.
- For generators *mentioned* in `include`:
  - String form ("whole generator"): everything from the generator
    emits.
  - Object form (per-operation or per-model): only matched items
    emit; unmatched items are skipped with `result: 'skipped'` in
    the manifest.
- Matching is exact — no wildcards.

**Use case**: opt-in generators like form/table/page-shell that
would otherwise emit dozens of files per endpoint. Configure
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

Per-generator, per-operation user overrides. Routed by a four-level
key:

```
enrichments[generatorId][projectionKind][operationOrRefId][projectionKey]
```

Example:

```jsonc
{
  "enrichments": {
    "@skmtc/gen-shadcn-form": {
      "mutation": {
        "CreateContact": {
          "form": {
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
}
```

Each generator declares the accepted shape via Valibot in
`gen-x/src/enrichments.ts`. Unknown fields are stripped silently;
type mismatches surface as parse errors.

See [enrichments-shape reference](enrichments-shape.md) and
[enrichments concept](../../concepts/enrichments.md).

### `settings.packages` (optional, advanced)

For projects that emit code into multiple packages (e.g., a
monorepo where types and validators land in different workspace
packages). Each entry maps a path prefix to a package name; the
engine uses this when emitting cross-package imports.

Most projects don't need this. Default: `[]`.

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
        "mutation": {
          "CreateContact": {
            "form": {
              "title": "Create Contact",
              "submitLabel": "Create"
            }
          },
          "UpdateContact": {
            "form": {
              "title": "Edit Contact",
              "submitLabel": "Save"
            }
          }
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
        "mutation": {
          "CreateCustomer": {
            "form": { "title": "Create Customer", "submitLabel": "Create" }
          }
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
- Missing required fields (`settings.basePath`) → recipe error
- Absolute `basePath` → recipe error at `init` time
- Unknown fields under `settings.enrichments[gen]` → silently
  stripped (Valibot's default)

## Editing workflows

`client.json` is intended for direct user editing. The CLI doesn't
expose subcommands like `skmtc set source ./schema.json` —
hand-editing is the recommended approach.

Some workflows that touch `client.json`:

- **`skmtc init`** writes the initial minimal version
- **`skmtc install`** may add per-generator default settings (rare)
- Everything else is manual: enrichments, include/skip, source pinning

After editing, the next `skmtc generate` picks up the new config.
No rebundle needed — `client.json` is runtime config, not bundle
code.

## See also

- [enrichments-shape reference](enrichments-shape.md) — the routing structure
- [source-resolution reference](source-resolution.md) — how `source` is resolved
- [enrichments concept](../../concepts/enrichments.md) — mental model
- [projects-and-workspaces concept](../../concepts/projects-and-workspaces.md) — where this file lives
- [`skmtc-cli` skill §6](../../skills/skmtc-cli/SKILL.md) — operational guidance
