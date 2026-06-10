# skmtc publish

> Build and publish an immutable **version** of a project's stack to
> skmtc-hub.

`publish` uploads a local SKMTC project to the hub as a new immutable
stack version. Stacks are published packages (like generators);
versions are addressed by semver. Projects on the hub pin a stack
version and own all execution — deployments, runs, and the
`production` alias live on projects and are driven from the web app,
not the CLI.

A stack's identity on the hub is **`<authenticated user>/<project>`**.
The PAT picks the account; the project name is the stack slug. There
is no `--stack` flag: the destination is fully determined by who
you're authenticated as and which project you're publishing. (Org-
owned stacks aren't yet reachable from `skmtc publish`.)

The version comes from the project root `deno.json#version`, or from
`--version`. Versions are immutable — re-publishing an existing semver
is rejected with a `409`. The CLI never invents or auto-bumps a
version.

## Synopsis

```
skmtc publish <project> --token <pat> [--version <semver>] [--hub-url <url>] [--json] [--no-input]
```

## Arguments

### `<project>`

The project name under `.skmtc/<project>/`. Required. Doubles as the
stack slug — the version lands on the stack `<auth-handle>/<project>`.

## Options

### `--token <pat>`

Personal access token. Resolution order:

1. `--token` flag
2. `$SKMTC_HUB_TOKEN`
3. The token stored by [`skmtc login`](login.md) (`~/.skmtc/auth.json`)

Mint one in the SPA's account settings (`write:releases` alone is
enough). The PAT also determines the account half of the stack
identity — the CLI looks up your handle with `GET /v1/user` at
publish time.

### `--version <semver>`

The version to publish. Defaults to the project root
`deno.json#version`. If neither is present, publish fails fast (before
any network call) with a recipe-style error.

### `--hub-url <url>`

Hub base URL. Defaults to `$SKMTC_HUB_URL`; then — only when the
token came from the stored `skmtc login` file — the `host` recorded
in that file; then `https://api.skmtc.dev`. The stored-host step
keeps token and destination coherent: a token minted against a local
dev hub is never silently sent to production.

### `--no-input` / `--json`

See the [overview](overview.md#shared-flags).

## What publish does

```
1. Resolve the version
     `--version` wins; otherwise the project root deno.json#version.
     Missing → fail at stage `version` before any network call.

2. GET /v1/user
     Resolves the PAT to the authenticated user's `handle`. That handle
     is the `account` half of the stack identity; the project name is
     the `slug` half.

3. bundleDeploy(project)
     → <project>/server.js   (one self-contained bundle: the generator
        composition + createServer + @skmtc/server + @skmtc/core, all
        inlined, nothing external)

4. POST /v1/stacks/{handle}/{project}/versions   (multipart, atomic)
     One `version` part (semver) + one `bundle` part (server.js) + N
     `files` parts (one per project source file). The hub writes the
     bundle + source to R2, reconciles the stack's generator
     composition from the uploaded deno.json, and returns the complete
     StackVersion.
```

There is no metadata-only intermediate state — the publish is atomic
(version + bundle + source in one request). Each step has its own
failure stage in the result envelope (below).

The hub auto-creates the stack on first publish under the
authenticated user's own account — the same "git push creates the
repo" behavior as before.

## Strict mode

When `--no-input` or `--json` is set:

- Missing `<project>`, or no token from any source (`--token`,
  `$SKMTC_HUB_TOKEN`, stored `skmtc login`) → exit code 2 with a
  recipe error on stderr.
- The Ink TUI is skipped; publish runs straight through
  `publishHeadless` and prints either a one-line text summary or a
  single JSON object.

## JSON output

### Success

```jsonc
{
  "kind": "published",
  "projectName": "my-api",
  "bundlePath": ".skmtc/my-api/server.js",
  "bundleBytes": 1228801,
  "bundleSha256": "e3b0c44298fc1c14...",
  "stack": { "account": "ada", "slug": "my-api" },
  "version": "3.0.1",
  "versionUrl": "https://skmtc.dev/ada/stacks/my-api/versions/3.0.1",
  "sourceFileCount": 28,
  "sourceTotalBytes": 96512
}
```

There is no `deploymentId`, `shortId`, or production alias — versions
are addressed by semver.

### Failure

```jsonc
{
  "kind": "failed",
  "projectName": "my-api",
  "reason": "version 3.0.1 is already published for ada/my-api — versions are immutable. ...",
  "stage": "publish"
}
```

Possible `stage` values:

| Stage | Where the failure happened |
|---|---|
| `version` | No version to publish — no `deno.json#version` and no `--version`. Fails before any network call. |
| `identity` | `GET /v1/user` failed — usually a bad PAT |
| `bundle` | `bundleDeploy` — Deno bundling failed locally, or reading the bundle / walking the source tree failed |
| `publish` | `POST /v1/stacks/.../versions` failed (commonly: `409` — that version is already published) |

## Text-mode output

### Success

```
Published "my-api" → ada/my-api@3.0.1
  bundle: .skmtc/my-api/server.js
  bytes: 1228801
  sha256: e3b0c44298fc1c14...
  source: 28 files, 96512 bytes
  version: https://skmtc.dev/ada/stacks/my-api/versions/3.0.1
```

### Failure

```
Publish failed for "my-api" at publish:
  version 3.0.1 is already published for ada/my-api — versions are immutable. ...
```

## What gets uploaded

### Bundle (one file)

`<project>/server.js` — the compiled CF-Workers entry point produced
by `bundleDeploy`. One self-contained bundle: `@skmtc/core` and
`@skmtc/server` are inlined, nothing external (~1.2 MB).

### Source tree (N files)

Walks `<project>/` and uploads every file except:

- Dotfiles (with the single exception of `.settings/`, which holds
  `client.json`).
- Root-level derived artefacts: `server.ts`, `server.js`, `bundle.js`,
  `worker.ts`.
- Binary asset extensions: `mp4`, `png`, `jpg`, `pdf`, archives, etc.

The hub treats `deno.json` as the source of truth for the stack's
generator composition and reconciles it per version: imports starting
`gen-` that resolve to a `jsr:` specifier become `imported`; the same
prefix resolving to a local path becomes `cloned`. Mixed states for
the same generator name are rejected (`422 — composition
inconsistency`). The root `deno.json` must be part of the upload.

## Errors

All errors use the uniform `ApiError` envelope (`{ code, message, … }`):

| Status | Meaning |
|---|---|
| `401` | No or invalid token |
| `403` | Publishing under an account that isn't yours (org publishing unsupported) |
| `409` | That version is already published — versions are immutable. Bump the version and re-publish. |
| `422` | Validation — missing `version`/`bundle`/root `deno.json`, composition inconsistent with the uploaded tree, size limits |

## Environment variables

| Variable | Purpose | Equivalent flag |
|---|---|---|
| `SKMTC_HUB_TOKEN` | Default PAT | `--token` |
| `SKMTC_HUB_URL` | Default hub base URL | `--hub-url` |

CLI flags always win over env vars; env vars win over the stored
`skmtc login` credential (so CI can override a developer login).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — stack version published with bundle + source |
| `1` | Operational failure at any publish stage |
| `2` | Missing required argument (recipe error on stderr) |

## Examples

### One-shot publish

```bash
SKMTC_HUB_TOKEN=$PAT skmtc publish my-api
```

or

```bash
skmtc publish my-api --token $SKMTC_HUB_TOKEN --version 3.0.1
```

### Agent / CI invocation

```bash
SKMTC_HUB_TOKEN=$PAT skmtc publish my-api --json --no-input
```

### Capture the published version in a script

```bash
VERSION=$(SKMTC_HUB_TOKEN=$PAT skmtc publish my-api --json | jq -r '.version')
echo "published → $VERSION"
```

## Compared with the previous deployment-based flow

Before the 2026-06 stacks-as-packages refactor, this command was
`skmtc deploy` and created an immutable stack *deployment* identified
by a UUID + 8-char `shortId`, with a `production` alias planned on the
stack. That model moved: stacks are now published packages whose
versions carry the bundle; *projects* pin a version and own
deployments, runs, and the `production` alias (driven from the web
app). The migration in one sentence: `deploy` → `publish` (the old
command is gone, not aliased), set a `version` in the project's
`deno.json` (or pass `--version`), and read `version`/`versionUrl`
instead of `deploymentId`/`shortId` from the JSON output.

## See also

- [skmtc bundle](bundle.md) — `bundleDeploy` is invoked internally by publish
- [overview](overview.md) — shared flags and strict-mode semantics
