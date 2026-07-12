# skmtc init

> Create a new SKMTC project workspace.

Creates `.skmtc/<projectName>/` with `deno.json` and
`.settings/client.json`. Idempotent — re-running on an existing
project is a no-op (returns `type: "existed"` in JSON mode).

## Synopsis

```
skmtc init [projectName] [basePath] [--json] [--no-input]
```

## Arguments

### `[projectName]`

The project name — becomes the subdirectory under
`<root>/.skmtc/`. Required in strict mode.

Convention: lowercase kebab-case (`my-api`, `mobile-app`,
`graphql-ops`). The CLI accepts other casings but kebab-case is
established practice.

### `[basePath]`

The `basePath` for generated output. Two-role value:

- The on-disk root for generated files (relative to the SKMTC root)
- The `@` alias root in the consuming app's bundler resolver

**Must be relative.** Absolute paths are rejected with exit 2 and a
recipe error. `init` does not create the directory at `basePath` —
it just records the value; the directory is created lazily by the
first `generate` run.

Required in strict mode.

## Options

### `--no-input`

Disable interactive prompts. Required in non-TTY environments.

### `--json`

Write JSON output to stdout. Implies `--no-input`.

## Behavior

### Files created

```
.skmtc/<projectName>/
├── deno.json
└── .settings/
    └── client.json
```

The created files:

**`deno.json`** — empty manifest:

```json
{}
```

`init` writes `{}` verbatim — `RootDenoJson.create(projectName)` in
`cli/lib/root-deno-json.ts` constructs the file with `contents: {}`.
Peer dependencies (`@skmtc/core`, `@skmtc/worker`, individual
`@skmtc/gen-*` packages) accrete lazily as subsequent `install` and
`clone` operations discover what they need. The first `install` or
`clone` adds the appropriate `imports` entries and Deno pins them
in the lockfile.

A consequence worth knowing: running `skmtc doctor` immediately
after `init` will report `project-core-pin/<project>` as missing
(there's nothing to compare yet). Run `install` or `clone` once and
the pin appears.

**`.settings/client.json`** — minimal config with the basePath:

```json
{
  "settings": {
    "basePath": "<basePath>"
  }
}
```

`source` is intentionally absent — set it after `init` to pin a
schema, or pass the schema positionally to `generate`.

### Idempotency

Re-running `init` with an existing project name is a no-op:

```jsonc
{ "type": "existed", "projectName": "my-api", "nextStep": null }
```

No files are overwritten; the existing config is preserved.

### basePath validation

The CLI rejects absolute paths:

```
$ skmtc init my-api /tmp/foo --json
Error: basePath must be relative, got "/tmp/foo"

Usage:   skmtc init <projectName> <basePath>
Example: skmtc init my-api ./src
```

Exit code 2.

The reason: `basePath` must align with the bundler's `@` alias root
in the consuming app. Absolute paths can't be portable across
machines or CI environments.

## JSON output

### On creation

```jsonc
{
  "type": "created",
  "projectName": "my-api",
  "basePath": "./src",
  "nextStep": "skmtc install <generators...> my-api"
}
```

### On existing

```jsonc
{
  "type": "existed",
  "projectName": "my-api",
  "nextStep": null
}
```

## Examples

### Basic interactive

```bash
cd ~/projects/my-app/        # the SKMTC root
skmtc init my-api ./src      # creates .skmtc/my-api/
```

### Agent / CI invocation

```bash
skmtc init my-api ./src --json --no-input
```

### Multiple projects in one root

```bash
skmtc init api-v1 src/generated/v1 --json
skmtc init api-v2 src/generated/v2 --json
skmtc init mocks  src/mocks --json
```

Each gets its own `.skmtc/<projectName>/` directory and its own
output location.

## basePath ↔ bundler alignment

The `basePath` value must match the `@` alias in the consuming
app's bundler config. Common configurations:

**Vite** (`vite.config.ts`):
```ts
resolve: { alias: { '@': '/src' } }
```
→ `basePath: "src"` (relative to the SKMTC root)

**Next.js** (`tsconfig.json`):
```json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```
→ `basePath: "src"`

**Custom subdirectory**:
```ts
resolve: { alias: { '@': '/mobile-app/src' } }
```
→ `basePath: "mobile-app/src"`

Generators produce paths like `@/forms/CreateUserForm.generated.tsx`.
At runtime the bundler resolves `@/...` to the alias root. On disk,
SKMTC writes to `<basePath>/forms/CreateUserForm.generated.tsx`. For
these to match, the two paths must point at the same directory.

The CLI doesn't verify the alignment — it can't read the consumer's
bundler config. The check is the user's responsibility, with help
from `skmtc doctor`'s `project-base-path/<project>` check (which
catches obvious mistakes like missing or absolute paths).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — project created OR already existed |
| `2` | Required argument missing OR `basePath` was absolute |

## See also

- [`skmtc install`](install.md) — typical next step after init
- [client.json schema](../settings/client-json-schema.md) — the full `client.json` shape
- [projects-and-workspaces concept](../../concepts/projects-and-workspaces.md) — the directory layout
- [client.json schema](../settings/client-json-schema.md) — full field reference
