# How to update a schema and regenerate

> Refresh generated output after the OpenAPI/GraphQL schema
> changes, including handling operations that no longer exist.

## When to use this

The backend team updated their API spec. You want to regenerate
to pick up the changes — and clean up artifacts for operations
or models the new spec no longer contains.

## Prerequisites

- A SKMTC project with `source` configured (URL or local path).
- The new schema is reachable (or the local file is updated).

## Steps

### Update the schema source

If `source` is a URL, nothing to do — `skmtc generate` re-fetches
on every run (no cache). Just re-run.

If `source` is a local file, replace it with the new version.

### Regenerate

```bash
skmtc generate <project>
```

The engine re-fetches/re-reads the source, re-parses, and produces
the new artifact set. Files for unchanged schemas come out
byte-identical; files for changed schemas are overwritten.

### Clean up files no longer produced

This is the manual step. The engine **only writes** — it doesn't
delete files that used to be generated and aren't anymore.

If the new spec removed an operation, the old `.generated.ts`
file for that operation persists on disk. Two ways to clean up:

**Option 1: Diff and delete.**

```bash
# Before generate, list the files
ls src/generated/**/*.generated.ts > before.txt
skmtc generate <project> --json | jq -r '.artifacts | keys[]' > after.txt
diff before.txt after.txt
# Manually delete files in before.txt but not in after.txt
```

**Option 2: Nuke and regenerate.**

```bash
rm -rf src/generated/
skmtc generate <project>
```

Cleaner but slower. Safe because every file in `src/generated/`
is regenerated.

## Verification

After regeneration, your application's existing imports should
still resolve (operations that didn't change). If imports break
due to removed operations, you'll need to update the consuming
code — that's expected.

Run `skmtc agent-context --json | jq '.projects[].lastGenerate'`
to confirm the run was recent and produced the expected number
of artifacts.

## Troubleshooting

- **Stale URL response** — There's no client-side cache; the CLI
  re-fetches on every run. If you're seeing old data, check the
  schema server itself (it may be caching).
- **Removed operations still log warnings** — If `client.json`
  has `enrichments` keyed by an operation that no longer exists,
  the engine silently ignores them. Cleanup is optional but
  reduces `client.json` clutter.
- **Generated output is wildly different** — Check `manifest.diagnostics`
  for parse errors on the new spec. A spec update may introduce
  parse issues that prune dependent operations.

## Related

- [How to pin schema source](pin-schema-source.md)
- [Source resolution reference](../../reference/settings/source-resolution.md)
- [How to debug failing generation](debug-failing-generation.md)
