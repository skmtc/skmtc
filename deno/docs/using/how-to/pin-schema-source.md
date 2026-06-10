# How to pin the schema source

> Configure `source` in `client.json` so `skmtc generate <project>`
> works without specifying the schema as an argument every time.

## When to use this

You have a stable schema URL or file path and want generation to
"just work" with `skmtc generate <project>`. For one-off
generates against a different schema, pass the path as a CLI
argument instead.

## Prerequisites

- A SKMTC project (run `skmtc init` first if needed).
- A schema source: HTTPS URL, HTTP URL, or relative/absolute
  filesystem path.

## Steps

### Set `source` in client.json

Edit `.skmtc/<project>/.settings/client.json`:

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
for format detection, OAS-3.1 → 3.0 normalization, and other
details.

### Verify resolution

```bash
skmtc generate <project>
```

If the source is reachable and parses, generation runs. If not,
the CLI reports a parse error with the source URL/path it tried.

## Verification

Generation succeeds without a positional schema argument. Confirm
by running `skmtc agent-context --json | jq '.projects[] | select(.name=="<project>") | .schema'`
— it should report the configured `source` and a recent
`lastFetched` timestamp.

## Troubleshooting

- **"GET <url> returned 401"** — The schema endpoint requires
  auth, but SKMTC doesn't support auth headers in `client.json`
  (for security reasons; see [source-resolution
  reference](../../reference/settings/source-resolution.md#authentication)).
  Bundle the spec to a local file or run a local proxy.
- **"GET <url> returned 404"** — Wrong URL, or the endpoint is
  unreachable. Check directly with `curl`.
- **Relative path not found** — Paths in `source` resolve against
  the **workspace root**, not the project directory. Use
  `./openapi.json` for a workspace-root spec; use
  `./.skmtc/<project>/openapi.json` for a project-local spec.
- **"Failed to convert Swagger 2 to OAS 3.0"** — The spec uses a
  Swagger-2-specific feature that the converter can't handle.
  Pre-convert the spec with `swagger2openapi` and use the result.

## Related

- [Source resolution reference](../../reference/settings/source-resolution.md)
- [client.json schema reference](../../reference/settings/client-json-schema.md)
- [How to update a schema and regenerate](update-a-schema.md)
