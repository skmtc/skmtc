# skmtc deploy

> Build and upload an immutable **deployment** of a project to skmtc-hub.

`deploy` is the publish path from a local SKMTC project to the hub.
Each invocation creates a new, immutable deployment that the hub
identifies by a UUID and an 8-character `shortId`.

A stack's identity on the hub is **`<authenticated user>/<project>`**.
The PAT picks the account; the project name is the stack slug. There
is no `--stack` flag: the destination is fully determined by who
you're authenticated as and which project you're deploying. (Org-
owned stacks aren't yet reachable from `skmtc deploy`.)

There is also no semver — the deployment's identity is the upload
itself — and no implicit promotion to anything. Promoting a
deployment to your stack's `production` alias is a separate decision
(today via the SPA, later via a `--production` flag).

## Synopsis

```
skmtc deploy <project> --token <pat> [--hub-url <url>] [--json] [--no-input]
```

## Arguments

### `<project>`

The project name under `.skmtc/<project>/`. Required. Doubles as the
stack slug — the deployment lands on the stack `<auth-handle>/<project>`.

## Options

### `--token <pat>`

Personal access token. Required (or set `$SKMTC_HUB_TOKEN`). Mint one
in the SPA's account settings. The PAT also determines the account
half of the stack identity — the CLI looks up your handle with
`GET /v1/user` at deploy time.

### `--hub-url <url>`

Hub base URL. Defaults to `$SKMTC_HUB_URL` or `https://api.skmtc.dev`.

### `--no-input` / `--json`

See the [overview](overview.md#shared-flags).

## What deploy does

```
1. GET /v1/user
     Resolves the PAT to the authenticated user's `handle`. That handle
     is the `account` half of the stack identity; the project name is
     the `slug` half.

2. bundleSplit(project)
     → <project>/server.js          (compiled project bundle)
     → <project>/runtime/core.js    (@skmtc/core bundled)
     → <project>/runtime/server.js  (@skmtc/server bundled)
   Reads the pinned @skmtc/server version from project deno.json.

3. GET /v1/runtimes/{serverVersion}
     200 → runtime is already on the hub; skip step 4.
     404 → upload both halves via PUT /v1/runtimes/{X}/{core,server}.js.

4. POST /v1/stacks/{handle}/{project}/deployments
     Body: { "runtimeServerVersion": "0.2.10" }
     Response: Deployment row with id (UUID) + shortId + htmlUrl.

5. POST /v1/stacks/{handle}/{project}/deployments/{shortId}/bundle
     Multipart with a single `bundle` part carrying server.js.

6. POST /v1/stacks/{handle}/{project}/deployments/{shortId}/source
     Multipart with N `files` parts (one per project source file).
     Writes source to R2 and reconciles the stack's
     stack_generator_refs from the uploaded deno.json.
```

Each step has its own failure stage in the result envelope (below).

## Strict mode

When `--no-input` or `--json` is set:

- Missing `<project>` or `--token` (and no `$SKMTC_HUB_TOKEN`) → exit
  code 2 with a recipe error on stderr.
- The Ink TUI is skipped; deploy runs straight through `deployHeadless`
  and prints either a one-line text summary or a single JSON object.

## JSON output

### Success

```jsonc
{
  "kind": "deployed",
  "projectName": "my-api",
  "bundlePath": ".skmtc/my-api/server.js",
  "bundleBytes": 1228801,
  "bundleSha256": "e3b0c44298fc1c14...",
  "stack": { "account": "ada", "slug": "my-api" },
  "deploymentId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "shortId": "7c9e6679",
  "deploymentUrl": "https://app.skmtc.dev/ada/stacks/my-api/deployments/7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "runtimeServerVersion": "0.2.10",
  "runtimeUploaded": false,
  "sourceFileCount": 28,
  "sourceTotalBytes": 96512
}
```

### Failure

```jsonc
{
  "kind": "failed",
  "projectName": "my-api",
  "reason": "deployment POST failed (404): Stack not found",
  "stage": "deployment-create"
}
```

Possible `stage` values:

| Stage | Where the failure happened |
|---|---|
| `identity` | `GET /v1/user` failed — usually a bad PAT |
| `bundle` | `bundleSplit` — Deno bundling failed locally |
| `runtime-check` | `GET /v1/runtimes/{X}` returned non-200/404 |
| `runtime-upload` | `PUT /v1/runtimes/{X}/{half}` failed |
| `deployment-create` | `POST /v1/stacks/.../deployments` failed (commonly: stack doesn't exist yet) |
| `bundle-upload` | reading `server.js` or `POST .../bundle` failed |
| `source-upload` | walking the tree or `POST .../source` failed |

The deployment row exists in D1 after step 4 (status `active`,
`bundle_key=null`, `source_root_key=null`), gains its bundle after
step 5, and is "complete" only after step 6. A run dispatched against
an incomplete deployment 422s.

## Text-mode output

### Success

```
Deployed "my-api" → ada/my-api (7c9e6679)
  bundle: .skmtc/my-api/server.js
  bytes: 1228801
  sha256: e3b0c44298fc1c14...
  runtime: 0.2.10 (reused)
  source: 28 files, 96512 bytes
  deployment: https://app.skmtc.dev/ada/stacks/my-api/deployments/7c9e6679-...
```

### Failure

```
Deploy failed for "my-api" at deployment-create:
  POST /v1/stacks/ada/my-api/deployments returned 404: Stack not found
```

## What gets uploaded

### Bundle (one file)

`<project>/server.js` — the compiled CF-Workers entry point produced
by `bundleSplit`. `@skmtc/core` and `@skmtc/server` are externalised;
they ship once per `serverVersion` via the runtime halves.

### Source tree (N files)

Walks `<project>/` and uploads every file except:

- Dotfiles (with the single exception of `.settings/`, which holds
  `client.json`).
- Root-level derived artefacts: `server.ts`, `server.js`, `bundle.js`,
  `worker.ts`, and the `runtime/` directory.
- Binary asset extensions: `mp4`, `png`, `jpg`, `pdf`, archives, etc.

The hub treats `deno.json` as the source of truth for the stack's
generator composition and reconciles `stack_generator_refs` to match:
imports starting `gen-` that resolve to a `jsr:` specifier become
`imported`; the same prefix resolving to a local path becomes
`cloned`. Mixed states for the same generator name are rejected
(`422 — composition inconsistency`).

### Runtime halves (zero or two files)

`<project>/runtime/{core,server}.js`. Uploaded only when
`GET /v1/runtimes/{serverVersion}` 404s. Subsequent deploys pinning
the same `@skmtc/server` version skip this step.

## Environment variables

| Variable | Purpose | Equivalent flag |
|---|---|---|
| `SKMTC_HUB_TOKEN` | Default PAT | `--token` |
| `SKMTC_HUB_URL` | Default hub base URL | `--hub-url` |

CLI flags always win over env vars.

## Pre-flight: the stack must already exist

`deploy` does not create stacks. If the destination
`<handle>/<project>` doesn't exist yet, the deployment-create step
404s. Create the stack first — through the SPA or
`POST /v1/stacks` — then re-run deploy.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success — deployment created and bundle + source uploaded |
| `1` | Operational failure at any deploy stage |
| `2` | Missing required argument (recipe error on stderr) |

## Examples

### One-shot deploy

```bash
SKMTC_HUB_TOKEN=$PAT skmtc deploy my-api
```

or

```bash
skmtc deploy my-api --token $SKMTC_HUB_TOKEN
```

### Agent / CI invocation

```bash
SKMTC_HUB_TOKEN=$PAT skmtc deploy my-api --json --no-input
```

### Capture the new shortId in a script

```bash
SHORT=$(SKMTC_HUB_TOKEN=$PAT skmtc deploy my-api --json | jq -r '.shortId')
echo "deployed → $SHORT"
```

## Compared with the previous release-based flow

Before the 2026-05-29 collapse, `deploy` accepted `--stack`,
`--version`, and `--notes`, and created a Release row keyed by
`(stack, version)`. That model is gone. The migration in one
sentence: drop all three flags; the stack is `<authenticated handle>/
<project>`, the deployment's identity is the upload, and there are no
release notes — record context in your VCS commit message instead.

## See also

- [skmtc bundle](bundle.md) — `bundleSplit` is invoked internally by deploy
- [overview](overview.md) — shared flags and strict-mode semantics
