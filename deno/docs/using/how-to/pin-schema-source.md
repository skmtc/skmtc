# How to pin the schema source

> Configure `source` in `skmtc.config.json` so `skmtc generate <project>`
> works without specifying the schema as an argument every time.

## When to use this

You have a stable schema URL or file path and want generation to
"just work" with `skmtc generate <project>`. For one-off
generates against a different schema, pass the path as a CLI
argument instead.

## Prerequisites

- A Skmtc project (run `skmtc init` first if needed).
- A schema source: HTTPS URL, HTTP URL, or relative/absolute
  filesystem path.

## Steps

### Pass the schema once with `--save`

```bash
skmtc generate <project> https://api.example.com/openapi.json --save
```

`--save` writes the schema you pass as `source` in the project's
config and changes no other key. It writes after a run with no error,
so a mistyped URL does not replace a source that works. To change the
source later, run the command again with the new schema.

### Or set `source` in skmtc.config.json

Edit `.skmtc/<project>/.settings/skmtc.config.json`:

```jsonc
{
  "source": "https://api.example.com/openapi.json",
  "settings": {
    "basePath": "src/generated"
  }
}
```

Supported source formats:

- HTTPS / HTTP URLs (auto-detected by `Content-Type` or content
  sniff)
- Relative paths (`./openapi.yaml`, resolved against the
  **workspace root**, not the project directory)
- Absolute paths (`/path/to/openapi.json`)

See [source resolution reference](../../reference/settings/source-resolution.md)
for format detection, Swagger 2 → OAS 3.0 conversion, and other
details.

### Verify resolution

```bash
skmtc generate <project>
```

If the source is reachable and parses, generation runs. If not,
the CLI reports a parse error with the source URL/path it tried.

## Verification

Generation succeeds without a positional schema argument. Confirm
by running `skmtc agent-context --json | jq '.projects[] | select(.name=="<project>") | .schemaSource'`.
It prints the `source` that you set. It prints `null` when the project
has none.

## Troubleshooting

- **"could not fetch the schema from <url>: 401 Unauthorized"** —
  The schema endpoint requires auth, but Skmtc doesn't support auth
  headers in `skmtc.config.json` (for security reasons; see
  [source-resolution
  reference](../../reference/settings/source-resolution.md#authentication)).
  Bundle the spec to a local file or run a local proxy.
- **"could not fetch the schema from <url>: 404 Not Found"** — Wrong
  URL. Check directly with `curl`.
- **"the answer from <url> is not a schema"** — The URL sent a
  page that is not a schema. An example is a login page. Check it
  with `curl`.
- **Relative path not found** — Paths in `source` resolve against
  the **workspace root**, not the project directory. Use
  `./openapi.json` for a workspace-root spec; use
  `./.skmtc/<project>/openapi.json` for a project-local spec.
- **"Failed to convert Swagger 2 to OAS 3.0"** — The spec uses a
  Swagger-2-specific feature that the converter can't handle.
  Pre-convert the spec with `swagger2openapi` and use the result.

## Related

- [Source resolution reference](../../reference/settings/source-resolution.md)
- [skmtc.config.json schema reference](../../reference/settings/client-json-schema.md)
- [How to update a schema and regenerate](update-a-schema.md)
