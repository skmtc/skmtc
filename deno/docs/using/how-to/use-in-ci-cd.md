# How to use SKMTC in CI/CD

> Run `skmtc generate` reliably in continuous integration, with
> appropriate verification gates.

## When to use this

You want generation to run automatically — either on every PR
(verify the committed output matches what would be regenerated)
or on a schedule (regenerate when the schema changes).

## Prerequisites

- A working SKMTC project locally.
- A CI runner that supports Deno installation (most do).

## Steps

### Pin the Deno version

Add the Deno version to your CI config so the runtime is
deterministic. For GitHub Actions:

```yaml
- uses: denoland/setup-deno@v1
  with:
    deno-version: v1.46.x   # match your local version
```

### Install the CLI in CI

```bash
deno install -A -g -n skmtc jsr:@skmtc/cli@<version>/mod.ts
```

Pin to a specific CLI version. The CLI itself doesn't appear in
your project's `deno.json` (it's a global install) — pin via the
JSR specifier.

### Bundle (if any generators are cloned)

If the project has cloned or locally-created generators, rebuild
the bundle in CI:

```bash
skmtc bundle <project>
```

If the project is JSR-only (no clones), this step is unnecessary
— the published bundle is used.

### Run with `--no-input --json`

```bash
skmtc generate <project> --no-input --json > generate-output.json
```

The `--no-input` flag enforces strict mode (no interactive
prompts). `--json` produces machine-parseable output for
downstream verification.

Pipe to `jq` for any post-checks you need:

```bash
fails=$(jq '.manifest.diagnostics | map(select(.level == "error")) | length' generate-output.json)
if [ "$fails" -gt 0 ]; then
  echo "Generation produced $fails errors"
  jq '.manifest.diagnostics' generate-output.json
  exit 1
fi
```

### Archive the manifest

Upload the `manifest.json` as a CI artifact for retrospective
inspection:

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: skmtc-manifest
    path: .skmtc/<project>/manifest.json
```

Useful when debugging an unexpected generation outcome later.

## Verification

Add a "drift check" step that confirms the committed generated
files match what would be regenerated:

```bash
skmtc generate <project> --no-input
git diff --exit-code src/generated/
```

If the diff is non-empty, the committed output is stale — fail
the build and prompt the developer to regenerate.

## Troubleshooting

- **Schema URL unreachable in CI** — The CI environment may have
  network restrictions. Either pin the schema to a local file
  committed in the repo, or use a CI secret for the URL with
  appropriate firewall config.
- **`skmtc generate` times out** — Large schemas (thousands of
  operations) can take a while. Increase the CI timeout or
  partition into multiple smaller projects.
- **Lockfile changes in CI** — If `skmtc install` was run on
  another branch, the lockfile may need updating. Commit
  lockfile changes deliberately, not as part of every generate
  run.
- **"Stale bundle" warning** — Add `skmtc bundle` before `skmtc
  generate` in your CI flow.

## Related

- [`skmtc generate` reference](../../reference/cli/generate.md)
- [`skmtc bundle` reference](../../reference/cli/bundle.md)
- [`skmtc doctor` reference](../../reference/cli/doctor.md) —
  useful as a CI pre-check
